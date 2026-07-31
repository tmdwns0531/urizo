-- v0.8 LIVE persistence expansion.
--
-- This migration is additive to the accepted v0.7 Run/Trace baseline. It
-- contains no credentials and does not import identity, profile, auth, or
-- engagement state.

BEGIN;

CREATE SCHEMA IF NOT EXISTS "extensions";
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";

-- Internal counter used by the Trace repository to allocate a per-Run
-- sequence with one atomic UPDATE. It is not part of the public persistence
-- DTO.
ALTER TABLE "recommendation_runs"
  ADD COLUMN "next_trace_sequence" INTEGER NOT NULL DEFAULT 1;

-- Existing v0.7 databases may already contain Trace rows. Backfill before a
-- LIVE writer can append, otherwise the first new sequence could collide.
UPDATE "recommendation_runs" AS runs
SET "next_trace_sequence" = COALESCE(
  (
    SELECT MAX(traces."sequence") + 1
    FROM "agent_traces" AS traces
    WHERE traces."run_id" = runs."id"
  ),
  1
);

-- A Run exists before catalog/search/model execution. These fields are only
-- materialized after search produces a real continuation; no fake vector or
-- fingerprint is persisted for an unmaterialized initial RUNNING/FAILED attempt.
ALTER TABLE "recommendation_runs"
  ALTER COLUMN "execution_mode" DROP DEFAULT,
  ALTER COLUMN "execution_mode" DROP NOT NULL,
  ALTER COLUMN "input_fingerprint" DROP NOT NULL,
  ALTER COLUMN "query_vector" DROP NOT NULL;

ALTER TABLE "recommendation_runs"
  ADD CONSTRAINT "recommendation_runs_lifecycle_shape_check" CHECK (
    (
      "status" = 'RUNNING'
      AND "response_snapshot" IS NULL
      AND "error_code" IS NULL
      AND "completed_at" IS NULL
    )
    OR (
      "status" = 'AWAITING_APPROVAL'
      AND "execution_mode" IS NOT NULL
      AND "input_fingerprint" IS NOT NULL
      AND "query_vector" IS NOT NULL
      AND "response_snapshot" IS NOT NULL
      AND "response_snapshot"->>'status' = 'awaiting_approval'
      AND "error_code" IS NULL
      AND "completed_at" IS NULL
    )
    OR (
      "status" = 'COMPLETED'
      AND "execution_mode" IS NOT NULL
      AND "input_fingerprint" IS NOT NULL
      AND "query_vector" IS NOT NULL
      AND "response_snapshot" IS NOT NULL
      AND "response_snapshot"->>'status' = 'completed'
      AND "error_code" IS NULL
      AND "completed_at" IS NOT NULL
    )
    OR (
      "status" = 'FAILED'
      AND "response_snapshot" IS NULL
      AND "error_code" IN ('BAD_REQUEST', 'NOT_FOUND', 'INTERNAL_ERROR')
      AND "completed_at" IS NOT NULL
    )
  );

CREATE TYPE "CatalogMediaType" AS ENUM ('MOVIE', 'SERIES');
CREATE TYPE "CatalogAgeRating" AS ENUM ('ALL', '7', '12', '15', '18', 'UNKNOWN');
CREATE TYPE "CatalogProvider" AS ENUM ('NETFLIX', 'TVING', 'DISNEY_PLUS', 'WAVVE', 'WATCHA', 'COUPANG_PLAY');
CREATE TYPE "CatalogProviderLinkType" AS ENUM ('DIRECT', 'SEARCH', 'HOME');

CREATE TABLE "catalog_contents" (
    "id" VARCHAR(64) NOT NULL,
    "tmdb_id" INTEGER NOT NULL,
    "media_type" "CatalogMediaType" NOT NULL,
    "title" TEXT NOT NULL,
    "synopsis" TEXT NOT NULL,
    "runtime_minutes" INTEGER NOT NULL,
    "release_year" INTEGER NOT NULL,
    "genres" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "mood_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "companion_tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "age_rating" "CatalogAgeRating" NOT NULL DEFAULT 'UNKNOWN',
    "origin_countries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "production_countries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "collection_id" VARCHAR(64),
    "vote_average" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vote_count" INTEGER NOT NULL DEFAULT 0,
    "poster_url" TEXT,
    "backdrop_color" VARCHAR(16) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "catalog_contents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "catalog_contents_runtime_positive_check" CHECK ("runtime_minutes" > 0),
    CONSTRAINT "catalog_contents_release_year_check" CHECK ("release_year" BETWEEN 1870 AND 2200),
    CONSTRAINT "catalog_contents_vote_average_check" CHECK ("vote_average" BETWEEN 0 AND 10),
    CONSTRAINT "catalog_contents_vote_count_check" CHECK ("vote_count" >= 0)
);

CREATE TABLE "provider_availabilities" (
    "content_id" VARCHAR(64) NOT NULL,
    "provider" "CatalogProvider" NOT NULL,
    "watch_url" TEXT NOT NULL,
    "link_type" "CatalogProviderLinkType" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "provider_availabilities_pkey" PRIMARY KEY ("content_id", "provider")
);

CREATE TABLE "content_search_documents" (
    "id" VARCHAR(64) NOT NULL,
    "content_id" VARCHAR(64) NOT NULL,
    "locale" VARCHAR(16) NOT NULL DEFAULT 'ko-KR',
    "document_text" TEXT NOT NULL,
    "content_hash" CHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_search_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_embeddings" (
    "id" VARCHAR(64) NOT NULL,
    "search_document_id" VARCHAR(64) NOT NULL,
    "model" VARCHAR(64) NOT NULL,
    "dimensions" INTEGER NOT NULL DEFAULT 1536,
    "embedding" extensions.vector(1536) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "content_embeddings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "content_embeddings_dimensions_check" CHECK ("dimensions" = 1536)
);

CREATE UNIQUE INDEX "catalog_contents_tmdb_media_key"
  ON "catalog_contents"("tmdb_id", "media_type");
CREATE INDEX "catalog_contents_active_media_idx"
  ON "catalog_contents"("is_active", "media_type");
CREATE INDEX "provider_availabilities_provider_content_idx"
  ON "provider_availabilities"("provider", "content_id");
CREATE UNIQUE INDEX "content_search_documents_content_hash_key"
  ON "content_search_documents"("content_id", "content_hash");
CREATE INDEX "content_search_documents_content_active_idx"
  ON "content_search_documents"("content_id", "is_active");
CREATE UNIQUE INDEX "content_search_documents_one_active_idx"
  ON "content_search_documents"("content_id")
  WHERE "is_active" = TRUE;
CREATE UNIQUE INDEX "content_embeddings_document_model_key"
  ON "content_embeddings"("search_document_id", "model");
CREATE INDEX "content_embeddings_document_idx"
  ON "content_embeddings"("search_document_id");
CREATE INDEX "content_embeddings_embedding_hnsw_cosine_idx"
  ON "content_embeddings"
  USING hnsw ("embedding" extensions.vector_cosine_ops);

ALTER TABLE "provider_availabilities"
  ADD CONSTRAINT "provider_availabilities_content_id_fkey"
  FOREIGN KEY ("content_id") REFERENCES "catalog_contents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_search_documents"
  ADD CONSTRAINT "content_search_documents_content_id_fkey"
  FOREIGN KEY ("content_id") REFERENCES "catalog_contents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "content_embeddings"
  ADD CONSTRAINT "content_embeddings_search_document_id_fkey"
  FOREIGN KEY ("search_document_id") REFERENCES "content_search_documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- All v0.8 persistence is server-only. Supabase exposes the public schema
-- through its Data API, while tables created by migrations do not receive the

-- dashboard's automatic RLS protection. Enable deny-by-default RLS and remove
-- inherited Data API grants without assuming Supabase roles exist in every
-- developer PostgreSQL instance.
ALTER TABLE "recommendation_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_traces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "catalog_contents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_availabilities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content_search_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content_embeddings" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  "recommendation_runs",
  "agent_traces",
  "catalog_contents",
  "provider_availabilities",
  "content_search_documents",
  "content_embeddings"
FROM PUBLIC;

DO $server_only_permissions$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE "recommendation_runs", "agent_traces", "catalog_contents", "provider_availabilities", "content_search_documents", "content_embeddings" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE "recommendation_runs", "agent_traces", "catalog_contents", "provider_availabilities", "content_search_documents", "content_embeddings" FROM authenticated';
  END IF;
END
$server_only_permissions$;

ANALYZE "catalog_contents";
ANALYZE "content_embeddings";

COMMIT;
