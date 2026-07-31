# Team ownership and integration boundaries

## Authority and current state

The binding five-person plan is
[`BACKEND-SPRINT-OWNERSHIP-v0.7.md`](./BACKEND-SPRINT-OWNERSHIP-v0.7.md), under
the product scope in
[`OTT-DAMOA-MVP-v0.6.md`](./OTT-DAMOA-MVP-v0.6.md). This file is a concise
pointer and review guide; it does not replace either source.

The historical A–E model assigned login/profile work to A and engagement/MY to
E. That model is retired for new MVP work because v0.6 excludes those product
areas. Deprecated auth/profile/engagement files still support the transitional
Demo until the ordered v0.7 cleanup. Do not extend them and do not delete a
shared legacy contract from an independent feature branch before its consumers
are merged away.

## Active v0.7 vertical owners

| Owner | Vertical responsibility | Primary integration result |
|---|---|---|
| 1 — integration owner | Anonymous Platform, Run, composition, health/reset, release | anonymous POST/GET boundary, Run mapping/CAS, release gate |
| 2 | Catalog, Eligibility, OTT, DB Gate | safe fixture candidates, link semantics, two-model Prisma gate |
| 3 | CHOICE, Query, Local Search | neutral form/request, query vector, deterministic continuation |
| 4 | Ranking, Selector, Fallback, Result | scored unique TOP5, budget mechanics, completed-result child |
| 5 | Policy, Approval, Replacement, Trace, Interaction | final policy, state transitions, one-slot replacement, public timeline |

Every owner delivers their backend boundary, assigned frontend integration,
domain/E2E tests, and handoff export. Owner 1 coordinates integration but does
not replace another owner's business logic or relax their tests.

Exact file ownership, branch examples, merge slots, test files, acceptance
criteria, and cleanup order are in v0.7 sections 3–14.

## Day 1 baseline imports

| Consumer | Contract/import path |
|---|---|
| all API consumers | `src/contracts/mvp-api.ts` |
| owner 2 catalog facts and repository | `src/contracts/catalog.ts`, `CatalogRepository` from `src/contracts/ports.ts` |
| owner 3 CHOICE/search/continuation | `src/contracts/mvp-search.ts`, `RecommendationSearchAdapter` from `src/contracts/mvp-ports.ts` |
| owner 4 ranking/selector/fallback | `src/contracts/mvp-recommendation.ts`, `RecommendationSelectorAdapter` from `src/contracts/mvp-ports.ts`, executor types from `src/domains/recommendation/executors/types.ts` |
| owner 5 Run/Trace mocks and services | `src/contracts/mvp-recommendation.ts`, `RecommendationRunRepository` and `AgentTraceRepository` from `src/contracts/mvp-ports.ts` |
| owner 1 adapter/composition wiring | `MvpAdapterConfig` from `src/config/adapters.ts`, `MvpAdapterSet` and `MvpComposition` from `src/composition/types.ts` |

The public CHOICE DTO uses ordinary arrays and strings so frontend state and
mocks are assignable. Owner 3 enforces single companion, single avoidance
genre, allowed values, uniqueness, and 140 Unicode code points at the request
parser. Persistence-safe types do not contain the natural-language field.

## Shared and review-gated areas

| Area | Single writer / required review |
|---|---|
| `src/contracts/catalog.ts` | owner 2; affected consumers review |
| `src/contracts/mvp-search.ts` | owner 3; owners 2, 4, 5 review |
| `src/contracts/mvp-recommendation.ts`, `src/contracts/mvp-ports.ts` | baseline then owner 1; owners 2, 3, 4, 5 review affected boundaries |
| Prisma schema and migration | owner 2; Run mapping owner 1 and Trace owner 5 review |
| `src/composition/*`, adapter config | owner 1; each adapter owner provides/reviews exports |
| mandatory eligibility semantics | owner 2; final-policy owner 5 reviews |
| budget/executor/fallback mechanics | owner 4; policy owner 5 reviews transitions |
| final policy, approval, replacement, Trace | owner 5; catalog/search/ranking owners review their inputs |
| shared contract tests | contributing contract owner plus every affected consumer |
| architecture/ownership pointers | owner 1; affected owners review |

Do not create a repository-wide barrel. Direct module paths keep mocks
provider-neutral and reduce five-owner merge conflicts.

## Target cross-owner request path

```text
CHOICE UI and request parser (3)
-> anonymous API and Run mapping (1)
  -> policy/workflow boundary (5)
    -> catalog eligibility (2)
    -> local search/continuation (3)
    -> ranking/selector/fallback mechanics (4)
    -> final policy, Trace, approval/replacement (5)
-> completed result child (4)
-> interaction/timeline container (5)
-> OTT card/link behavior (2)
```

There is no authentication/user-context step, public `/api/search`, backend
engagement write, MY projection, or anonymous Run-list step in the target.

## Independent development boundary

After the baseline:

- owner 1 can mock `AnonymousRecommendationServices`;
- owner 2 can mock `SanitizedRecommendationSearchInput`;
- owner 3 can use fixture `CatalogContent[]`;
- owner 4 can mock catalog/search output and implement
  `RecommendationSelectorAdapter`;
- owner 5 can mock `MvpRecommendationExecutor`,
  `RecommendationRunRepository`, and `AgentTraceRepository`.

Mocks depend only on the active paths above. Concrete adapters are selected
only in composition. A branch must remain typecheckable without another
owner's unmerged implementation.

## State and safety review

- Public status is only `completed | awaiting_approval`.
- Internal lifecycle is
  `RUNNING | AWAITING_APPROVAL | COMPLETED | FAILED`.
- Approval widens only 30 to 45 minutes, once, after explicit approval.
- Replacement keeps `COMPLETED`, changes one slot, and increments Run revision.
- Run update uses expected-revision compare-and-set.
- Trace append assigns an atomic per-Run sequence in the repository and exposes
  only `PUBLIC` projection.
- No owner may weaken anonymous age, provider, runtime, origin, exclusion, or
  replacement safety to fill five slots.

## Database collaboration

Owner 2 gates the two-model schema and migrations. Owner 1 owns sanitized Run
business mapping; owner 5 owns Trace mapping. The baseline has no User,
Profile, Subscription, Catalog, Provider, Embedding, Item, Approval, or
Engagement model.

No external database is needed for schema validation or the default Demo.
Actual Prisma implementation/smoke work occurs only after a selected adapter
has real private connection values and separate authority. Never put
connection values in migrations, fixtures, source, logs, or documentation.

## Integration and Git hygiene

- Confirm `.git`, the accepted baseline commit, `dev`, and the remote before
  team branching.
- Missing Git metadata is a team-development blocker. Do not initialize or
  push without repository-owner direction.
- Branch each v0.7 vertical slice from the same accepted baseline on `dev`.
- Open feature PRs into `dev`; do not push directly to `dev` or `main`.
- Follow the merge and legacy cleanup order in v0.7 section 10.3.
- Contract changes use a small separate commit and affected-owner review.
- Never commit `.env.local`, secrets, tokens, database URLs, logs, generated
  build output, or raw production Trace detail.

Before merge/handoff run `db:validate`, `lint`, `typecheck`, `test`, and
`build`. Integration owner 1 classifies failures; the responsible vertical
owner fixes them.
