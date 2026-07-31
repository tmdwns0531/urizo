-- Initial v0.6/v0.7 Run-and-Trace-only schema.
-- Generated from an empty datamodel without connecting to an external DB.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RecommendationRunStatus" AS ENUM ('RUNNING', 'AWAITING_APPROVAL', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecommendationExecutionMode" AS ENUM ('DETERMINISTIC', 'OPENAI', 'FALLBACK');

-- CreateEnum
CREATE TYPE "TraceVisibility" AS ENUM ('INTERNAL', 'PUBLIC');

-- CreateEnum
CREATE TYPE "TraceAction" AS ENUM ('filter', 'vector_search', 'score', 'select', 'policy_block', 'approval_request', 'approval_decision', 'fallback', 'replacement', 'complete');

-- CreateTable
CREATE TABLE "recommendation_runs" (
    "id" VARCHAR(64) NOT NULL,
    "status" "RecommendationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "execution_mode" "RecommendationExecutionMode" NOT NULL DEFAULT 'DETERMINISTIC',
    "input_fingerprint" VARCHAR(71) NOT NULL,
    "request_snapshot" JSONB NOT NULL,
    "query_vector" JSONB NOT NULL,
    "response_snapshot" JSONB,
    "excluded_content_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "replaced_content_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "candidate_count" INTEGER NOT NULL DEFAULT 0,
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "model_call_count" INTEGER NOT NULL DEFAULT 0,
    "tool_call_count" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "policy_block_count" INTEGER NOT NULL DEFAULT 0,
    "fallback_reason" VARCHAR(32),
    "error_code" VARCHAR(32),
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "recommendation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_traces" (
    "id" VARCHAR(64) NOT NULL,
    "run_id" VARCHAR(64) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "action" "TraceAction" NOT NULL,
    "visibility" "TraceVisibility" NOT NULL,
    "detail" JSONB NOT NULL,
    "public_message" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_traces_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recommendation_runs_status_created_idx" ON "recommendation_runs"("status", "created_at");

-- CreateIndex
CREATE INDEX "recommendation_runs_fingerprint_idx" ON "recommendation_runs"("input_fingerprint");

-- CreateIndex
CREATE INDEX "agent_traces_run_visibility_idx" ON "agent_traces"("run_id", "visibility", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "agent_traces_run_sequence_key" ON "agent_traces"("run_id", "sequence");

-- AddForeignKey
ALTER TABLE "agent_traces" ADD CONSTRAINT "agent_traces_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "recommendation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
