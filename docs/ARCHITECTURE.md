# OTT 다모아 Demo MVP architecture

This document turns the v0.5 plan and the 2026-07-30 handoff into implementation
boundaries. The primary constraint is that a useful Demo must run without
authentication credentials, Supabase, pgvector, or OpenAI while exercising the
same recommendation and policy code used by Live adapters.

## Runtime profiles are assembled per capability

`APP_PROFILE=demo` provides defaults; it is not a global `if demo` switch.
Every external capability is selected independently at the composition root.

| Capability | Environment selector | Demo default | Future Live option |
|---|---|---|---|
| authentication | `AUTH_ADAPTER` | `demo` | `authjs` (or the auth decision adopted later) |
| catalog | `CATALOG_ADAPTER` | `fixture` | `prisma` |
| search | `SEARCH_ADAPTER` | `local` | `pgvector` |
| final selector | `SELECTOR_ADAPTER` | `deterministic` | `openai` |
| recommendation runs | `RUN_STORE` | `memory` | `prisma` |
| traces | `TRACE_STORE` | `memory` | `prisma` |
| engagement | `ENGAGEMENT_STORE` | `memory` | `prisma` |

Selection happens once in `src/composition`. Pages, route handlers, features,
and domain services receive contracts; they do not read adapter environment
variables and do not branch on Demo versus Live. A Live adapter is loaded
lazily only when selected, and only that adapter validates its required
variables. For example, `AUTH_ADAPTER=demo` must not require OAuth variables,
and `SEARCH_ADAPTER=local` must not require a database or embedding key.

Do not infer a runtime profile from `localhost`, a hostname, or whether a
variable happens to exist. Missing selectors mean the Demo defaults above.
Unknown selector values fail fast with a message naming the invalid selector;
missing Live credentials fail only after that Live adapter is selected.

## Dependency direction

```text
app -> features -> domains -> contracts
                       |
                       v
                      lib

composition -> contracts + adapters + domain constructors
adapters    -> contracts (+ external SDKs)
```

The enforceable rules are:

- `contracts` imports no other internal layer.
- `lib` imports none of `app`, `features`, or `domains`.
- domains depend on external systems only through contracts.
- features coordinate domain use cases and contain no provider SDK calls.
- app routes and pages translate HTTP/UI data and call features.
- adapters implement contracts but never become domain dependencies.
- composition is the only place that chooses concrete adapters.
- avoid a repository-wide barrel `index.ts`; it concentrates five owners'
  edits and creates avoidable merge conflicts.

## Stable contracts and adapter seams

The shared contracts cover `UserContext`, catalog content, search input/results,
recommendation requests/responses, approval proposals, public trace events, and
engagement events. Concrete seams are intentionally capability-sized:

| Contract role | Demo implementation | Live implementation responsibility |
|---|---|---|
| current user | fixed, safe Demo user | session/auth adapter |
| user/profile | memory/fixture profile | Prisma user repository |
| catalog | reviewed fixtures | Prisma/TMDB catalog repository |
| candidate search | local token/tag similarity | parameterized pgvector raw SQL |
| final selection | deterministic selector | OpenAI structured selection |
| run and approval state | process memory | Prisma run repository |
| audit trace | process memory | Prisma trace repository |
| engagement and MY projection | process memory | Prisma engagement repository |

External systems vary; the core does not. Demo and Live share mandatory filters,
score normalization and weighting, collection diversity handling, budget
counters, approval transitions, final policy enforcement, rule-based fallback,
public trace conversion, and safe replacement selection.

## Recommendation execution boundary

```text
Recommendation API
  -> Orchestrator
    -> Policy layer
      -> RecommendationExecutor
         |- PipelineRecommendationExecutor  (MVP)
         `- AgentRecommendationExecutor     (future seam only)
      -> registered tools
```

The policy layer wraps the executor. An executor cannot bypass:

- LLM, embedding, token, and elapsed-time budget counters;
- the registered tool allowlist;
- the user approval gate;
- response-time mandatory policy validation; or
- internal trace recording and the separately sanitized public timeline.

The MVP implements only `PipelineRecommendationExecutor`. The agent executor and
tool registry are interface/extension points, not permission to introduce an
agent loop into the Demo. A future agent must emit the same executor result and
remain inside the same policy wrapper.

## Recommendation sequence

1. Merge the current user context and CHOICE request.
2. Apply non-negotiable filters before semantic search: age safety, Korean
   availability, runtime, watched content, and subscription restrictions.
3. Apply preference exclusions unless the user explicitly requested that genre.
4. Search candidates locally or with pgvector through the search contract.
5. Normalize score components, calculate the configured hybrid score, and apply
   deterministic collection diversity handling.
6. Select up to five candidates through the selector contract.
7. Re-run mandatory policy checks immediately before returning a response.
8. Persist run state and internal traces; expose only sanitized public trace
   events.

The selector may choose and explain candidates already supplied to it. It never
decides age, runtime, subscription, or diversity rules and cannot invent an
out-of-pool catalog item.

## Demo scenario flows

Normal recommendation:

```text
Demo user -> CHOICE -> filters -> local search -> scoring/diversity
          -> deterministic five -> final policy check -> TOP1 + four + timeline
```

One-step approval:

```text
30-minute request -> only three candidates -> AWAITING_APPROVAL
  |- approve: explicitly widen runtime to 45 minutes -> re-search once -> result
  `- reject: keep original constraints -> return the three safe candidates
```

Policy block:

```text
minor/forced scenario -> unsafe adult item injected into proposed output
-> final policy check removes it -> policy_block trace -> safe partial response
```

Budget fallback:

```text
forced budget exhaustion -> stop executor -> deterministic rule-based TOP5
-> fallback badge -> fallback trace
```

Replacement never relaxes mandatory constraints. It excludes every item already
shown in the run, selects the next safe candidate deterministically, records a
new item revision, and preserves the replaced item for audit. Saved, watched,
not-interested, and OTT-click actions append engagement events; a current-state
projection supports exclusion filters and the MY tabs.

## Persistence and pgvector

Memory and fixture repositories are authoritative only for a Demo process.
`prisma/schema.prisma` defines the future Live relational model for users,
profiles, subscriptions, catalog/provider links, search documents/embeddings,
runs/items/approvals/traces, and engagement. Importing Prisma from the Demo
composition is forbidden.

The Live search adapter uses Supabase PostgreSQL with pgvector. The embedding
column is `Unsupported("vector(1536)")`; vector writes and cosine queries use
parameterized Prisma raw SQL. Mandatory filters are resolved before vector
ranking, and the query is constrained to those allowed candidate IDs. Never
interpolate natural-language input or vector text into SQL.

Live persistence keeps contract-critical arrays and presentation fields
explicit: production countries, companion tags, backdrop color, exclusion and
replacement IDs, and recommendation reasons. Engagement event enum values are
identical across the contract and Prisma (`BOOKMARK`, `UNBOOKMARK`, `WATCHED`,
`NOT_INTERESTED`, `OTT_CLICK`), so adapters do not rely on undocumented enum
translation.

`prisma/sql/pgvector.sql` is a reviewed migration fragment for enabling the
extension, enforcing one active search document, and adding the HNSW cosine
index. The shared Supabase project uses a developer-specific schema selected by
the connection string. Extension enablement is database-wide; migrations into
a shared schema are reviewed and applied by the database owner.

Request/user snapshots and item content snapshots make runs explainable after a
profile or catalog change. Internal trace detail may contain operational data;
the public timeline is generated from allowlisted fields and `publicMessage`,
never by returning raw trace JSON.

## Environment and secret principles

- Personal values live in `.env.local`; only variable names and safe Demo
  defaults belong in `.env.example`.
- `.env`, `.env.local`, and `.env.*.local` stay out of Git.
- Teammates merge variable names, never one another's values.
- Deployment values are configured in the deployment secret store later.
- No OAuth, database, or OpenAI value is required for the default Demo.
- No secret, OAuth token, raw prompt containing private profile data, or database
  URL is written to traces, fixtures, source files, or documentation.
- External deployment and GitHub publication are outside the current local-Demo
  scope.

## v0.5 ambiguities and adopted MVP decisions

The source plan's numbered sections end at **14.8**. The handoff refers to
“14.9 recommendation-agent expansion,” but that section is absent from the
provided v0.5 file. Therefore the executor seam described above is a
handoff-derived extension boundary, not a claim about missing source text. No
agent runtime is implemented for the MVP.

Section 9.4 lists a relaxation order (runtime, then origin country, then mood),
while section 12 explicitly excludes multi-step relaxation from the MVP. The
MVP decision is one approval opportunity only: widen a 30-minute runtime limit
by 50% to 45 minutes. Approval triggers one re-search; rejection returns the
safe partial result. Country and mood relaxation remain future capabilities
represented by extensible approval data, not reachable MVP transitions.

Other source decisions still pending are the auth library, Vercel Fluid Compute
and function duration, and provider search URL formats. These do not block the
Demo. The 25-second application budget remains the temporary Live ceiling unless
the eventual platform ceiling is shorter.
