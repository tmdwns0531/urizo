-- Migration fragment for the Prisma Live database only.
--
-- Do not run this file from the Demo profile. When the first Prisma migration
-- is created, place the extension statement before the generated table DDL and
-- the indexes after the generated content_search_documents/content_embeddings
-- table DDL. Keep this SQL under migration review by the catalog/DB owner.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Enforce one current search document while retaining prior versions for audit
-- and reproducible embedding rebuilds.
CREATE UNIQUE INDEX IF NOT EXISTS content_search_documents_one_active_idx
  ON content_search_documents (content_id)
  WHERE is_active = TRUE;

-- Prisma represents pgvector as Unsupported("vector(1536)"), so this operator
-- class index intentionally lives in SQL rather than schema.prisma.
CREATE INDEX IF NOT EXISTS content_embeddings_embedding_hnsw_cosine_idx
  ON content_embeddings
  USING hnsw (embedding extensions.vector_cosine_ops)
  WHERE embedding IS NOT NULL;

ANALYZE content_embeddings;
