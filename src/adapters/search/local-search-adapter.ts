import type { CatalogContent } from "../../contracts/catalog";
import type { RecommendationSearchAdapter } from "../../contracts/mvp-ports";
import {
  LOCAL_QUERY_VECTOR_ALGORITHM,
  type RecommendationSearchInvocation,
  type RecommendationSearchOutput,
  type SanitizedRecommendationSearchInput,
} from "../../contracts/mvp-search";
import type { SearchAdapter } from "../../contracts/ports";
import type { SearchInput, SearchResult } from "../../contracts/search";
import { SEARCH_LIMIT } from "../../config/recommendation";
import {
  buildMvpSearchQuery,
  buildSearchQuery,
} from "../../domains/search/query";
import {
  createInputFingerprint,
  createLocalQueryVector,
  localVectorSimilarity,
  semanticSimilarity,
  verifyRecommendationSearchContinuation,
} from "../../domains/search/semantic";

function sanitizeInitialInput(
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

/**
 * Active local adapter with persistence-safe vector continuation. Overloads
 * retain the deprecated Demo port while composition moves to the anonymous
 * RecommendationSearchAdapter.
 */
export class LocalSearchAdapter
  implements RecommendationSearchAdapter, SearchAdapter
{
  search(
    invocation: RecommendationSearchInvocation,
    candidates: CatalogContent[],
  ): Promise<RecommendationSearchOutput>;
  /** @deprecated Transitional authenticated Demo overload. */
  search(
    input: SearchInput,
    candidates: CatalogContent[],
  ): Promise<SearchResult[]>;
  async search(
    input: RecommendationSearchInvocation | SearchInput,
    candidates: CatalogContent[],
  ): Promise<RecommendationSearchOutput | SearchResult[]> {
    if ("kind" in input) {
      return this.searchMvp(input, candidates);
    }
    return this.searchLegacy(input, candidates);
  }

  private async searchMvp(
    invocation: RecommendationSearchInvocation,
    candidates: CatalogContent[],
  ): Promise<RecommendationSearchOutput> {
    let sanitizedInput: SanitizedRecommendationSearchInput;
    let queryVector;
    let inputFingerprint;

    if (invocation.kind === "initial") {
      sanitizedInput = sanitizeInitialInput(invocation.input);
      queryVector = createLocalQueryVector(
        buildMvpSearchQuery(invocation.input),
      );
      inputFingerprint = await createInputFingerprint(
        sanitizedInput,
        queryVector,
      );
    } else {
      sanitizedInput = sanitizeInitialInput(invocation.input);
      queryVector = await verifyRecommendationSearchContinuation(
        sanitizedInput,
        invocation.continuation,
      );
      if (queryVector.algorithm !== LOCAL_QUERY_VECTOR_ALGORITHM) {
        throw new Error(
          "LocalSearchAdapter requires a local-hash-cosine-v1 continuation",
        );
      }
      inputFingerprint = invocation.continuation.inputFingerprint;
    }

    if (queryVector.algorithm !== LOCAL_QUERY_VECTOR_ALGORITHM) {
      throw new Error(
        "LocalSearchAdapter cannot score a non-local query vector",
      );
    }

    const results = candidates
      .map((content) => ({
        content,
        semanticScore: localVectorSimilarity(queryVector, content),
      }))
      .sort(
        (left, right) =>
          right.semanticScore - left.semanticScore ||
          left.content.title.localeCompare(right.content.title, "ko") ||
          left.content.id.localeCompare(right.content.id),
      )
      .slice(0, SEARCH_LIMIT);

    return {
      results,
      continuation: {
        queryVector,
        inputFingerprint,
      },
      modelCallCount: 0,
      tokenUsage: 0,
    };
  }

  private async searchLegacy(
    input: SearchInput,
    candidates: CatalogContent[],
  ): Promise<SearchResult[]> {
    const query = buildSearchQuery(input);
    return candidates
      .map((content): SearchResult => {
        const similarity = semanticSimilarity(query, content);
        return {
          content,
          semanticScore: similarity.score,
          matchedTerms: similarity.matchedTerms,
        };
      })
      .sort(
        (left, right) =>
          right.semanticScore - left.semanticScore ||
          left.content.title.localeCompare(right.content.title, "ko"),
      )
      .slice(0, SEARCH_LIMIT);
  }
}
