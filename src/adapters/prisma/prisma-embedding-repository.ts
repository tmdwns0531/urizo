import { createId } from "../shared/id";
import { PrismaRepositoryError } from "./types";

const EMBEDDING_DIMENSIONS = 1536;

export interface PendingSearchDocument {
  id: string;
  contentId: string;
  documentText: string;
  contentHash: string;
}

export interface ContentEmbeddingInput {
  searchDocumentId: string;
  model: string;
  values: readonly number[];
}

export interface PrismaVectorSqlClient {
  $queryRawUnsafe<T>(
    query: string,
    ...values: unknown[]
  ): Promise<T>;
  $executeRawUnsafe(
    query: string,
    ...values: unknown[]
  ): Promise<number>;
}

const PENDING_DOCUMENTS_SQL = `
SELECT
  documents."id",
  documents."content_id" AS "contentId",
  documents."document_text" AS "documentText",
  documents."content_hash" AS "contentHash"
FROM "content_search_documents" AS documents
LEFT JOIN "content_embeddings" AS embeddings
  ON embeddings."search_document_id" = documents."id"
  AND embeddings."model" = $1
WHERE documents."is_active" = TRUE
  AND embeddings."id" IS NULL
ORDER BY documents."id" ASC
LIMIT $2
`;

const UPSERT_EMBEDDING_SQL = `
INSERT INTO "content_embeddings" (
  "id",
  "search_document_id",
  "model",
  "dimensions",
  "embedding",
  "created_at",
  "updated_at"
)
VALUES ($1, $2, $3, $4, $5::extensions.vector, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("search_document_id", "model")
DO UPDATE SET
  "dimensions" = EXCLUDED."dimensions",
  "embedding" = EXCLUDED."embedding",
  "updated_at" = CURRENT_TIMESTAMP
`;

function validateModel(model: string): void {
  if (!model || model.length > 64 || /[\u0000-\u001f]/.test(model)) {
    throw new PrismaRepositoryError("INVALID_VECTOR");
  }
}

export function serializePgVector(values: readonly number[]): string {
  if (
    values.length !== EMBEDDING_DIMENSIONS ||
    values.some((value) => !Number.isFinite(value))
  ) {
    throw new PrismaRepositoryError("INVALID_VECTOR");
  }
  return `[${values.join(",")}]`;
}

export class PrismaContentEmbeddingRepository {
  constructor(private readonly client: PrismaVectorSqlClient) {}

  async listPendingDocuments(
    model: string,
    limit = 50,
  ): Promise<PendingSearchDocument[]> {
    validateModel(model);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      throw new PrismaRepositoryError("INVALID_VECTOR");
    }
    return this.client.$queryRawUnsafe<PendingSearchDocument[]>(
      PENDING_DOCUMENTS_SQL,
      model,
      limit,
    );
  }

  async upsert(input: ContentEmbeddingInput): Promise<void> {
    validateModel(input.model);
    if (
      !input.searchDocumentId ||
      input.searchDocumentId.length > 64
    ) {
      throw new PrismaRepositoryError("INVALID_VECTOR");
    }
    const serialized = serializePgVector(input.values);
    await this.client.$executeRawUnsafe(
      UPSERT_EMBEDDING_SQL,
      createId("embedding"),
      input.searchDocumentId,
      input.model,
      EMBEDDING_DIMENSIONS,
      serialized,
    );
  }
}
