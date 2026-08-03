-- A clarification turn waits before catalog search and therefore has no
-- execution mode, fingerprint, or query vector yet. Runtime relaxation turns
-- remain fully materialized.
ALTER TABLE "recommendation_runs"
  DROP CONSTRAINT "recommendation_runs_lifecycle_shape_check";

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
      AND "response_snapshot" IS NOT NULL
      AND "response_snapshot"->>'status' = 'awaiting_approval'
      AND "error_code" IS NULL
      AND "completed_at" IS NULL
      AND (
        (
          "response_snapshot"->'proposal'->>'kind' = 'FAMILY_COMPOSITION'
          AND "execution_mode" IS NULL
          AND "input_fingerprint" IS NULL
          AND "query_vector" IS NULL
        )
        OR (
          "response_snapshot"->'proposal'->>'kind' = 'RUNTIME_RELAXATION'
          AND "execution_mode" IS NOT NULL
          AND "input_fingerprint" IS NOT NULL
          AND "query_vector" IS NOT NULL
        )
      )
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
