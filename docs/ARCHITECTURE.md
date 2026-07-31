# OTT 다모아 v0.6 Demo architecture

## Authority and transition status

The product and acceptance source is
[`OTT-DAMOA-MVP-v0.6.md`](./OTT-DAMOA-MVP-v0.6.md). The implementation and
five-person ownership source is
[`BACKEND-SPRINT-OWNERSHIP-v0.7.md`](./BACKEND-SPRINT-OWNERSHIP-v0.7.md).
Those documents take precedence over this summary.

The v0.7 Day 1 baseline is active for shared types and persistence:

- anonymous-MVP DTOs and persistence-safe types in `src/contracts/mvp-*.ts`;
- active executor types in
  `src/domains/recommendation/executors/types.ts`;
- `MvpAdapterConfig`, `MvpAdapterSet`, and `MvpComposition`;
- a Prisma schema and initial migration containing only
  `RecommendationRun` and `AgentTrace`;
- compile-time and executable baseline contract tests.

The existing `createComposition` and Demo flow still use deprecated
authentication, profile, and engagement contracts. Login/profile/MY routes and
legacy tests may therefore remain until the v0.7 vertical slices merge in the
documented cleanup order. They preserve the pre-baseline Demo while teams
develop independently; they are not the v0.6 target architecture and must not
be extended. The baseline does not claim that the five product slices are
already implemented.

## Target runtime capabilities

The anonymous v0.6 target selects only these capabilities at the composition
root:

| Capability | Selector | Default | Optional adapter |
|---|---|---|---|
| catalog | fixed | fixture | none in MVP |
| candidate search | fixed | local | none in MVP |
| final selector | `SELECTOR_ADAPTER` | deterministic | OpenAI |
| recommendation Run store | `RUN_STORE` | memory | Prisma |
| Agent Trace store | `TRACE_STORE` | memory | Prisma |

Authentication, profile, catalog DB, pgvector search, and engagement store are
not active v0.6 capabilities. During transition, the deprecated Demo config
continues to parse its old selectors only so the existing runtime can compile
and execute. New code uses `readMvpAdapterConfig` and
`validateSelectedMvpAdapters`.

Missing selectors choose the credential-free defaults. Unknown values fail
fast. Only a selected OpenAI selector validates `OPENAI_API_KEY`; only a
selected Prisma Run or Trace store validates `DATABASE_URL` and `DIRECT_URL`.
An unavailable selected Live adapter must return a safe failure and must not
silently switch persistence modes.

## Dependency direction

```text
app -> domains -> contracts

composition -> contracts + adapters + domain constructors
adapters    -> contracts (+ selected external SDK)
```

- Contracts import no adapters or SDKs.
- Domains use external capabilities only through contracts.
- Routes and UI translate HTTP/UI values and call domain services.
- Adapters implement contracts and are never imported as domain dependencies.
- `src/composition` is the only concrete adapter selection boundary.
- The default path must not initialize Prisma or OpenAI.
- Prefer direct imports or small local exports; do not create a
  repository-wide barrel that becomes a five-owner merge hotspot.

## Shared contract boundaries

| Boundary | Active path |
|---|---|
| CHOICE, request, transient/sanitized search, vector continuation | `src/contracts/mvp-search.ts` |
| public response, Run lifecycle/storage, budget/fallback, Trace DTO | `src/contracts/mvp-recommendation.ts` |
| search, selector, Run, and Trace ports; Demo reset capability | `src/contracts/mvp-ports.ts` |
| six public API descriptors and DTO association | `src/contracts/mvp-api.ts` |
| executor attempt/context/port | `src/domains/recommendation/executors/types.ts` |
| adapter selection type/default/validation | `src/config/adapters.ts` |
| adapter set and service composition type | `src/composition/types.ts` |

Deprecated contracts in `user.ts`, `engagement.ts`, `search.ts`,
`recommendation.ts`, and `ports.ts` remain only where the transitional Demo
imports them. Active v0.7 names are distinct, so no declaration merge or
last-day rename is required.

## Recommendation and policy sequence

```text
validate and normalize anonymous CHOICE
-> mandatory catalog eligibility filter
-> initial local vector search or continuation search
-> hybrid ranking and collection diversity penalty
-> deterministic/OpenAI selector inside budget
-> response-time mandatory policy recheck
-> approval gate, fallback, or completion
-> sanitized Run snapshot and ordered Trace append
-> public response with PUBLIC Trace projection
```

The policy boundary wraps execution. It owns the final filter, 30-to-45 minute
approval transition, fallback decision, replacement safety, and sanitized Trace
recording. A selector can select only unique IDs from its candidate allowlist.
It cannot decide age, provider, runtime, origin, exclusion, diversity,
approval, or replacement rules.

The default deterministic selector is not a fallback. An OpenAI error, timeout,
invalid output, or budget breach can produce a deterministic rule-based
fallback with `executionMode=FALLBACK`, a public notice, an allowlisted reason,
and a budget snapshot.

## Anonymous continuation

Natural-language source text is transient. Initial search combines it with
CHOICE chip text, hashes the query into the versioned 64-dimensional local
vector, and discards raw text/token diagnostics after request processing.

Approval and replacement reuse:

- `SanitizedRecommendationSearchInput`;
- `QueryVectorSnapshot`;
- the initial `sha256:<64 lowercase hex>` input fingerprint.

They never require the original sentence. Runtime approval changes only the
effective runtime to 45 and does not recalculate the initial fingerprint.

## Persistence

The active relational model is defined together by:

- `docs/ERD-v0.7-baseline.md`;
- `prisma/schema.prisma`;
- `prisma/migrations/20260731090000_v07_run_trace_baseline/migration.sql`.

Only `RecommendationRun` and `AgentTrace` are active. Run stores sanitized
request/vector/response snapshots, CAS `revision`, aggregate budget counts,
exclusion/replacement history, lifecycle values, and timestamps. Trace stores
append-only allowlisted detail with a repository-assigned per-Run sequence.
`[runId, sequence]` is unique.

`run_<UUID>`, `trace_<UUID>`, and the Trace foreign key are PostgreSQL
`VARCHAR(64)`. The prefixed SHA-256 fingerprint is `VARCHAR(71)`. There is no
User relation or catalog/engagement persistence.

Memory and Prisma implementations must share the same sanitized repository DTO
and contract tests. General repositories have no list or clear method. Demo
reset uses a separate `DemoResettable.clearForDemo` capability on memory
implementations only.

## HTTP and privacy

The only target public endpoints are the six descriptors in
`MVP_API_ENDPOINTS`. There is no public candidate-search endpoint or anonymous
Run list. Public errors contain only:

```ts
{
  error: string;
  code: "BAD_REQUEST" | "NOT_FOUND" | "INTERNAL_ERROR";
}
```

Never return or persist user identity, natural-language source text, raw
tokens, matched terms, prompts, stack traces, secrets, database URLs, or raw
provider/DB errors. Aggregate `totalTokens` is budget telemetry and is allowed;
raw token content is not.

## Prisma validation and secrets

`npm run db:validate` uses a validation-only loopback URL in a Prisma CLI child
process. Prisma schema validation does not connect to PostgreSQL, no
`.env.local` is created, and caller credentials are not reused. Runtime
selection of a Prisma store still requires real `DATABASE_URL` and
`DIRECT_URL` values through `validateSelectedMvpAdapters`.

Personal values belong in `.env.local` or a deployment secret store. Only
names and safe defaults belong in `.env.example`. External database migration,
OpenAI credential smoke, deployment, and Git remote operations require their
separate authority and are not part of the credential-free baseline.

## Deferred work

The baseline does not implement the five vertical domain slices. Prisma
repositories, the OpenAI adapter, full anonymous orchestration, login removal,
engagement removal, approval/replacement domain work, pgvector, catalog DB,
agent loops, LangGraph, MCP, ReAct, TMDB runtime jobs, retention automation,
and catalog expansion remain assigned or deferred exactly as stated in v0.6
and the v0.7 ownership document.
