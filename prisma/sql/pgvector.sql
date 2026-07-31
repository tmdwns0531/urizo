-- Reference fragment for the Prisma LIVE database only.
--
-- The executable form now lives in
-- migrations/20260731160000_v08_live_catalog_vector/migration.sql. Keep this
-- file as a review aid; do not execute it in addition to the migration.

CREATE SCHEMA IF NOT EXISTS extensions;
DO $$
DECLARE
  current_vector_schema TEXT;
BEGIN
  SELECT namespaces.nspname
  INTO current_vector_schema
  FROM pg_extension AS extensions
  JOIN pg_namespace AS namespaces
    ON namespaces.oid = extensions.extnamespace
  WHERE extensions.extname = 'vector';

  IF current_vector_schema IS NULL THEN
    CREATE EXTENSION vector WITH SCHEMA extensions;
  ELSIF current_vector_schema <> 'extensions' THEN
    ALTER EXTENSION vector SET SCHEMA extensions;
  END IF;
END
$$;

-- Enforce one current search document while retaining prior content hashes for
-- reproducible embedding rebuilds.
CREATE UNIQUE INDEX IF NOT EXISTS content_search_documents_one_active_idx
  ON content_search_documents (content_id)
  WHERE is_active = TRUE;

-- Prisma represents pgvector as Unsupported("vector(1536)"), so this operator
-- class index intentionally lives in SQL rather than schema.prisma.
CREATE INDEX IF NOT EXISTS content_embeddings_embedding_hnsw_cosine_idx
  ON content_embeddings
  USING hnsw (embedding extensions.vector_cosine_ops);

ANALYZE content_embeddings;
