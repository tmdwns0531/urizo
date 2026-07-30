# Team ownership and integration boundaries

Ownership exists to let five contributors replace one adapter at a time without
blocking the environment-free Demo. It is a review responsibility, not a license
to bypass shared contracts or policy invariants.

## Primary owners

| Owner | Product/domain responsibility | Primary code areas |
|---|---|---|
| A | authentication, users, login, onboarding, profile | `domains/user`, auth/user adapters, login/onboarding/profile routes and features |
| B | catalog, TMDB ingestion, OTT availability and links, Prisma integration, migrations, seed data | `domains/catalog`, catalog adapters, `prisma`, `scripts/tmdb`, catalog fixtures |
| C | CHOICE input, query construction, embeddings, pgvector search, mood tagging | `domains/search`, search adapters, CHOICE features, `scripts/embeddings` |
| D | recommendation scoring, policy, approval, traces, results, replacement, executor/agent extension | `domains/recommendation`, recommendation adapters, recommendation APIs and result features |
| E | saved/watched/not-interested, MY, engagement events, shared UI and layout | `domains/engagement`, engagement adapters/APIs, MY features, shared components |

Two corrections are explicit:

- replacement selection belongs to D's recommendation domain, not E;
- OTT link resolution belongs to B's catalog domain, not E.

There is no public `/api/search`. D's recommendation use case calls C's search
contract server-side. This keeps filtering/policy orchestration in one trusted
request path and avoids exposing an ungoverned candidate search endpoint.

## Shared and review-gated areas

| Area | Change rule |
|---|---|
| `contracts` | proposing owner obtains review from every affected consumer; keep contracts provider-neutral |
| `composition` and adapter selector config | affected adapter owner plus D review recommendation-path changes |
| mandatory filters, budget, final policy check | D owns; A reviews age/user-context changes, B reviews catalog/availability semantics |
| Prisma schema and migrations | B owns and applies; affected domain owner reviews its tables and queries |
| Demo fixtures/scenarios | B owns catalog facts; the domain owner of each forced scenario reviews expected behavior |
| shared UI/layout | E owns; feature owner reviews product semantics |
| environment template | each owner adds names for their adapter; never values; composition reviewer checks Demo defaults |
| architecture/ownership documents | update in the same change whenever a boundary or responsibility changes |

Avoid repository-wide barrel files. Prefer direct imports or small
domain-local exports so concurrent changes do not converge on a single
`index.ts`.

## Adapter contribution contract

Each owner can develop a Live adapter while every other selector remains on its
Demo default. A Live adapter change is complete when:

1. it implements an existing contract or includes an explicitly reviewed
   contract change;
2. selection occurs only in `src/composition`;
3. its external SDK is not imported by the Demo path;
4. it validates only its own variables, and only when selected;
5. it has an adapter-level health/error message that does not disclose values;
6. contract tests run against both the Demo and Live implementation where
   credentials are available;
7. the no-environment Demo regression suite remains green; and
8. no page, route, feature, or domain contains a Demo/Live branch.

Live outages must become a typed adapter/use-case failure. They must not cause
another unselected Live integration to initialize. Recommendation execution may
use the defined deterministic fallback when policy permits; authentication or
write failures must be reported accurately rather than silently pretending a
write succeeded.

## Cross-owner request path

```text
CHOICE UI (C)
  -> recommendation API/use case (D)
    -> user context contract (A)
    -> catalog and provider contracts (B)
    -> candidate search contract (C)
    -> policy/executor/result/replacement (D)
    -> engagement event and MY projection (E)
```

The dependency is on contracts, not on another owner's concrete adapter. B can
switch the catalog repository to Prisma while C continues local search; A can
test Auth.js while D continues deterministic selection; E can persist
engagement while run/trace stores remain in memory.

## Scenario acceptance ownership

| Scenario | Driver | Required reviewers |
|---|---|---|
| normal TOP1 + four and public timeline | D | B for catalog facts, C for search |
| 30-to-45-minute approval and re-search | D | C for reconstructed query |
| rejected approval returns three safe items | D | E for result interaction |
| minor/adult policy block | D | A for age context, B for rating metadata |
| budget fallback and disclosure badge | D | E for shared presentation |
| save, watched, not-interested, MY tabs | E | D for recommendation exclusion behavior |
| safe immediate replacement | D | B for availability, E for triggering interaction |
| OTT link priority and fallback | B | E for presentation |

The MVP approval state machine has one decision only:

```text
RUNNING -> AWAITING_APPROVAL -> RUNNING -> COMPLETED/PARTIAL
                         |
                         `-> PARTIAL (rejected)
```

Only runtime relaxation from 30 to 45 minutes is reachable. Although the v0.5
policy section describes later country and mood steps, its MVP scope excludes
multi-step relaxation. Persisted approval kinds remain extensible, but adding a
second prompt requires a deliberate post-MVP product and contract change.

## Database collaboration

B is the migration gatekeeper for the future Live database. Domain owners
propose model/query needs; B checks naming, relations, indexes, retention, and
safe migration order. In the shared Supabase development project:

- each developer uses an individually named schema through their private
  connection configuration;
- the pgvector extension is enabled once at database scope;
- vector dimensions are fixed at 1,536 and smoke-tested;
- cosine similarity uses parameterized Prisma raw SQL;
- migration files contain no connection strings or credentials; and
- a shared-schema migration is applied only after review.

The Prisma model is not a reason to add database initialization to the Demo.
Memory stores remain valid contract implementations and are always tested.

## Integration and Git hygiene

- Keep a change within the owner's directories when possible.
- Split contract changes from adapter implementation when that makes review
  clearer.
- Rebase/merge environment **names**, never personal environment files.
- Do not commit generated logs, secrets, OAuth tokens, database URLs, or raw
  production traces.
- Do not introduce a default-path `throw new Error("not implemented")`.
- Before the first shared commit, require no-env Demo execution plus lint,
  typecheck, tests, build, and browser checks for every scenario above.
- GitHub connection, push, and deployment happen only after local Demo
  acceptance and explicit user authorization.

## Source-document caveat

The provided `ott-damoa-mvp-v0.5.md` ends at section 14.8. The agent executor
boundary comes from the later handoff, which referred to a missing section 14.9.
Treat it as an agreed extension seam, not implemented MVP behavior. If an
authoritative 14.9 is supplied later, D reconciles it with the policy wrapper
and records any architecture/ownership change in both project documents.
