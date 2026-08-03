import type { CatalogContent } from "../../contracts/catalog";
import type { RecommendationSearchAdapter } from "../../contracts/mvp-ports";
import {
  OPENAI_QUERY_VECTOR_ALGORITHM,
  OPENAI_QUERY_VECTOR_DIMENSIONS,
  OPENAI_QUERY_VECTOR_MODEL,
  type RecommendationSearchInvocation,
  type RecommendationSearchOutput,
  type SanitizedRecommendationSearchInput,
} from "../../contracts/mvp-search";
import { SEARCH_LIMIT } from "../../config/recommendation";
import { buildMvpSearchQuery } from "../../domains/search/query";
import {
  createInputFingerprint,
  parseQueryVectorSnapshot,
  verifyRecommendationSearchContinuation,
} from "../../domains/search/semantic";
import type { OpenAiEmbeddingClientPort } from "./openai-embedding-client";

export interface ParameterizedQueryResult<Row> {
  rows: readonly Row[];
}

export interface PgVectorDatabase {
  query<Row>(
    text: string,
    values: readonly unknown[],
  ): Promise<ParameterizedQueryResult<Row>>;
}

export interface PgVectorSearchAdapterOptions {
  embeddings: OpenAiEmbeddingClientPort;
  database: PgVectorDatabase;
  limit?: number;
}

interface PgVectorSearchRow {
  contentId: unknown;
  semanticScore: unknown;
}

export class PgVectorSearchError extends Error {
  readonly name = "PgVectorSearchError";
}

export const PGVECTOR_RECOMMENDATION_SEARCH_SQL = `
SELECT
  d.content_id AS "contentId",
  1 - (e.embedding <=> $1::extensions.vector) AS "semanticScore"
FROM content_embeddings AS e
JOIN content_search_documents AS d
  ON d.id = e.search_document_id
 AND d.is_active = TRUE
WHERE d.content_id = ANY($2::text[])
  AND e.model = $3
  AND e.dimensions = $4
ORDER BY
  e.embedding <=> $1::extensions.vector ASC,
  d.content_id ASC
LIMIT $5
`.trim();

function sanitizedInitialInput(
  input: RecommendationSearchInvocation["input"],
): SanitizedRecommendationSearchInput {
  return {
    selectedProviders: [...input.selectedProviders],
    companions: [...input.companions],
    moods: [...input.moods],
    desiredGenres: [...input.desiredGenres],
    companionAvoidGenres: [...input.companionAvoidGenres],
    requiredGenres: [...(input.requiredGenres ?? [])],
    excludedGenres: [...(input.excludedGenres ?? [])],
    mediaType: input.mediaType ?? "ANY",
    maxRuntimeMinutes: input.maxRuntimeMinutes,
    childAgeRatingLimit: input.childAgeRatingLimit ?? null,
    originPreference: input.originPreference,
    hasNaturalLanguage: input.hasNaturalLanguage,
  };
}

function pgVectorLiteral(values: readonly number[]): string {
  if (
    values.length !== OPENAI_QUERY_VECTOR_DIMENSIONS ||
    !values.every(Number.isFinite)
  ) {
    throw new PgVectorSearchError(
      `pgvector input must contain ${OPENAI_QUERY_VECTOR_DIMENSIONS} finite values`,
    );
  }
  return `[${values.join(",")}]`;
}

/**
 * OpenAI + pgvector search with no Node-only dependencies. SQL values are
 * parameterized, candidate IDs are restricted in SQL, and every returned ID
 * is checked again against the in-memory candidate allowlist.
 */
export class PgVectorSearchAdapter implements RecommendationSearchAdapter {
  private readonly embeddings: OpenAiEmbeddingClientPort;
  private readonly database: PgVectorDatabase;
  private readonly limit: number;

  constructor(options: PgVectorSearchAdapterOptions) {
    if (
      options.limit !== undefined &&
      (!Number.isInteger(options.limit) ||
        options.limit < 1 ||
        options.limit > SEARCH_LIMIT)
    ) {
      throw new PgVectorSearchError(
        `search limit must be an integer between 1 and ${SEARCH_LIMIT}`,
      );
    }
    this.embeddings = options.embeddings;
    this.database = options.database;
    this.limit = options.limit ?? SEARCH_LIMIT;
  }

  async search(
    invocation: RecommendationSearchInvocation,
    candidates: CatalogContent[],
    signal?: AbortSignal,
  ): Promise<RecommendationSearchOutput> {
    let input: SanitizedRecommendationSearchInput;
    let queryVector;
    let inputFingerprint;
    let modelCallCount: 0 | 1 = 0;
    let tokenUsage = 0;

    if (invocation.kind === "initial") {
      input = sanitizedInitialInput(invocation.input);
      const embedded = await this.embeddings.embed(
        buildMvpSearchQuery(invocation.input),
        signal,
      );
      modelCallCount = 1;
      tokenUsage = embedded.tokenUsage;
      queryVector = parseQueryVectorSnapshot({
        algorithm: embedded.algorithm,
        version: embedded.version,
        dimensions: embedded.dimensions,
        values: embedded.values,
      });
      inputFingerprint = await createInputFingerprint(input, queryVector);
    } else {
      input = sanitizedInitialInput(invocation.input);
      queryVector = await verifyRecommendationSearchContinuation(
        input,
        invocation.continuation,
      );
      inputFingerprint = invocation.continuation.inputFingerprint;
    }

    if (queryVector.algorithm !== OPENAI_QUERY_VECTOR_ALGORITHM) {
      throw new PgVectorSearchError(
        "PgVectorSearchAdapter requires an OpenAI 1536-dimensional vector",
      );
    }

    const candidatesById = new Map(
      candidates.map((content) => [content.id, content] as const),
    );
    if (candidatesById.size !== candidates.length) {
      throw new PgVectorSearchError("candidate IDs must be unique");
    }
    const candidateIds = [...candidatesById.keys()];

    if (candidateIds.length === 0) {
      return {
        results: [],
        continuation: { queryVector, inputFingerprint },
        modelCallCount,
        tokenUsage,
      };
    }

    if (signal?.aborted) {
      throw signal.reason instanceof Error
        ? signal.reason
        : new PgVectorSearchError("pgvector search was cancelled");
    }

    const queryResult = await this.database.query<PgVectorSearchRow>(
      PGVECTOR_RECOMMENDATION_SEARCH_SQL,
      [
        pgVectorLiteral(queryVector.values),
        candidateIds,
        OPENAI_QUERY_VECTOR_MODEL,
        OPENAI_QUERY_VECTOR_DIMENSIONS,
        this.limit,
      ],
    );

    const seen = new Set<string>();
    const results = queryResult.rows.map((row) => {
      if (typeof row.contentId !== "string") {
        throw new PgVectorSearchError("pgvector row contentId is malformed");
      }
      const content = candidatesById.get(row.contentId);
      if (!content) {
        throw new PgVectorSearchError(
          "pgvector returned a content ID outside the candidate allowlist",
        );
      }
      if (seen.has(row.contentId)) {
        throw new PgVectorSearchError(
          "pgvector returned a duplicate content ID",
        );
      }
      seen.add(row.contentId);
      if (
        typeof row.semanticScore !== "number" ||
        !Number.isFinite(row.semanticScore)
      ) {
        throw new PgVectorSearchError("pgvector semantic score is malformed");
      }
      return {
        content,
        semanticScore: Math.max(0, Math.min(1, row.semanticScore)),
      };
    });

    results.sort(
      (left, right) =>
        right.semanticScore - left.semanticScore ||
        left.content.title.localeCompare(right.content.title, "ko") ||
        left.content.id.localeCompare(right.content.id),
    );

    return {
      results: results.slice(0, this.limit),
      continuation: { queryVector, inputFingerprint },
      modelCallCount,
      tokenUsage,
    };
  }
}
