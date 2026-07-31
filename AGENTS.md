# OTT Damoa agent guide

## Authority and current status

- LIVE extension and acceptance source:
  `docs/OTT-DAMOA-LIVE-MVP-v0.8.md`
- Demo product scope and acceptance source: `docs/OTT-DAMOA-MVP-v0.6.md`
- Five-person execution and ownership source:
  `docs/BACKEND-SPRINT-OWNERSHIP-v0.7.md`
- Persistence source: `docs/ERD-v0.8-live.md`,
  `docs/ERD-v0.7-baseline.md`,
  `prisma/schema.prisma`, and `prisma/migrations/**`
- `docs/ARCHITECTURE.md` and `docs/TEAM-OWNERSHIP.md` summarize those sources
  and have lower priority.

The v0.7 anonymous contracts are the active runtime boundary. The Demo and LIVE
profiles both use the anonymous CHOICE, RecommendationRun, and AgentTrace flow.
Deprecated authentication/profile/engagement types may remain only as compile
compatibility while shared-contract cleanup is coordinated. Do not add login,
profile, MY, saved, watched, or backend not-interested behavior.

The v0.8 LIVE extension adds Prisma catalog storage, offline TMDB ingestion,
OpenAI embeddings with pgvector search, and an OpenAI selector. It does not
reintroduce identity or engagement. Keep the v0.6 credential-free Demo as a
first-class preset.

## Start here

- Use Node.js 22.13 or newer and npm.
- Windows: `npm.cmd ci`, then `npm.cmd run dev`.
- macOS/Linux: `npm ci`, then `npm run dev`.
- Open `http://localhost:3000`.
- Do not create `.env.local` for the default Demo.

The default Demo must run without credentials, a database, Supabase, pgvector,
or OpenAI.
Use `npm run dev:live` only for authorized local LIVE testing; its Node wrapper
forces the full LIVE preset without relying on an unsupported Vinext `--mode` flag.

## Required checks

Before handing work off, run:

- `npm run db:validate`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

`db:validate` uses a local validation-only URL inside the Prisma CLI child
process and does not connect to a database. Selecting a Prisma runtime adapter requires actual `DATABASE_URL`; migration commands require both `DATABASE_URL` and `DIRECT_URL`.

The integration suite covers the anonymous Demo regression flow and v0.8 LIVE
adapter contracts while retaining the accepted v0.7 contract gates.

## Architecture invariants

- Dependency direction: `app -> domains -> contracts`.
- Concrete integrations are injected only from `src/composition`.
- The v0.6 target default is fixture catalog, local search, deterministic
  selection, and memory Run/Trace stores.
- Validate only the environment variables required by a selected Live adapter.
- Do not import Prisma or OpenAI from the default Demo path.
- Do not add a public `/api/search`; recommendation orchestration calls search
  through its server-side contract.
- Executors and future agents remain inside policy, budget, approval,
  tool-registry, final-filter, and Trace boundaries.
- Never weaken age, provider, runtime, origin, exclusion, replacement, or final
  safety filters to make a test pass.
- The active Prisma schema contains `RecommendationRun`, `AgentTrace`, and
  only the catalog/provider/search-document/embedding models authorized by the
  v0.8 LIVE ERD.
- Never persist user identity, natural-language source text, raw tokens,
  matched terms, prompts, secrets, or backend engagement state in Run/Trace.
- TMDB is an ingestion pipeline, never a recommendation-request dependency.
- pgvector queries are parameterized and limited to catalog-eligibility IDs.

Read `docs/ARCHITECTURE.md` before changing a shared contract or composition
boundary.

## Active ownership

The v0.7 five-person vertical ownership remains the team baseline. The v0.8
LIVE module boundaries are additive:

- 1: LIVE preset, conditional environment validation, composition, health,
  integration, release
- 2: Prisma catalog schema/repository, TMDB ingestion, migrations
- 3: OpenAI embedding, pgvector search, vector continuation
- 4: OpenAI selector, model budget, deterministic fallback
- 5: final policy, Prisma Trace, approval/replacement continuation

The detailed v0.8 team allocation document may refine workload and branch
names, but it must preserve these single-writer boundaries.

The active v0.7 responsibilities remain:

- 1: Anonymous Platform, Run lifecycle, composition, health/reset, release
- 2: Catalog, eligibility, OTT links, Prisma schema/migrations
- 3: CHOICE, query construction, local vector search, continuation
- 4: Ranking, selector, budget mechanics, fallback, completed-result child
- 5: Policy, approval, replacement, Trace, result interaction

These roles replace the historical A–E login/engagement ownership model for
new work. Exact files, review gates, branch examples, merge order, and E2E
responsibility are in `docs/BACKEND-SPRINT-OWNERSHIP-v0.7.md`.

## Git workflow

- Confirm that `.git` exists and that `dev` is available before branching.
- If Git metadata is absent, report the repository as not team-development
  ready; do not initialize a repository or invent a remote without owner
  direction.
- Every contributor, including the repository owner, branches from the latest
  accepted `dev`; personal work never starts directly on `dev` or `main`.
- Feature branch names must use
  `feature/<github-id>_<work-slug>_<version>`.
- `<github-id>` is the contributor's exact GitHub login. `<work-slug>` uses
  lowercase ASCII letters, digits, and hyphens. `<version>` uses the agreed
  product version such as `v0.8` or `v0.8.1`.
- Example: `feature/tmdwns0531_live-runtime_v0.8`.
- Push only the feature branch and open a pull request into `dev`.
- Do not push commits directly to `dev` or `main`, including owner work.
- Merge reviewed feature pull requests into `dev`; promote `dev` to `main`
  only through the repository owner's release process.
- Keep one reviewable work item on one feature branch. A later team allocation
  document may assign work slugs, but it must keep this naming contract.
- Keep secrets in `.env.local` (never `.dev.vars*`); add variable names only to `.env.example`.
- Do not commit generated logs, build output, credentials, tokens, database
  URLs, or personal environment files.
- The detailed command sequence and examples are in
  `docs/GIT-WORKFLOW.md`.
