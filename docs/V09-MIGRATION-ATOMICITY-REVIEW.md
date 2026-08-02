# v0.9 lifecycle migration atomicity review

Review date: 2026-08-03

## Finding

The migration sequence was reviewed without connecting to or changing a LIVE
database.

| Order | Migration | Lifecycle effect | Transaction review |
|---:|---|---|---|
| 1 | `20260731090000_v07_run_trace_baseline` | Creates Run and Trace with materialized continuation columns | Accepted immutable baseline; no explicit transaction |
| 2 | `20260731160000_v08_live_catalog_vector` | Makes continuation columns nullable and adds the first lifecycle CHECK | Explicit `BEGIN`/`COMMIT` |
| 3 | `20260802090000_v09_bounded_agent_multiturn` | Replaces the CHECK with FAMILY and RUNTIME approval shapes | Drops then adds the CHECK without an explicit transaction |
| 4 | `20260803062000_v09_lifecycle_shape_atomic_hardening` | Atomically re-establishes and hardens the canonical v0.9 CHECK | Explicit `BEGIN`/`COMMIT` |

The risk is in migration 3: its `DROP CONSTRAINT` can commit before the later
`ADD CONSTRAINT`. If adding or validating the replacement fails, PostgreSQL can
be left without `recommendation_runs_lifecycle_shape_check`.

Migration 4 does not edit or squash migration 3. It drops the constraint with
`IF EXISTS` and re-adds it inside one transaction, so a failure while adding or
validating the canonical CHECK rolls the DROP back as well. The complete CHECK
predicate uses `IS TRUE`; missing JSON `status` or proposal `kind` keys therefore
cannot pass through PostgreSQL's normal CHECK acceptance of a null result.

## Canonical lifecycle shape

| Run state | Response | Mode / fingerprint / vector |
|---|---|---|
| `RUNNING` | null | May be unmaterialized or retained during an approved continuation |
| `AWAITING_APPROVAL + FAMILY_COMPOSITION` | `awaiting_approval` | All three null; catalog search has not run |
| `AWAITING_APPROVAL + RUNTIME_RELAXATION` | `awaiting_approval` | All three non-null |
| `COMPLETED` | `completed` | All three non-null |
| `FAILED` | null with an allowlisted error code | May be unmaterialized or retained from the failed attempt |

## Limitation and recovery boundary

This additive migration cannot retroactively make migration 3 atomic. A fresh
deployment must still pass migration 3 before Prisma proceeds to migration 4.
If migration 3 has already failed after its DROP, stop and inspect that target;
do not claim migration 4 ran or use `migrate resolve` without an approved repair
plan. The corrective migration guarantees atomic replacement only when it is
actually reached.

No `migrate deploy`, `migrate status`, constraint rollback test, or LIVE database
inspection was performed in this review. `db:validate` validates the Prisma
schema but does not execute migration SQL.

References: [Prisma Migrate transaction guidance](https://www.prisma.io/blog/prisma-migrate-dx-primitives),
[PostgreSQL transaction blocks](https://www.postgresql.org/docs/current/sql-begin.html),
and [PostgreSQL CHECK semantics](https://www.postgresql.org/docs/current/ddl-constraints.html).
