# OTT Damoa agent guide

## Authority and current status

- Product scope and acceptance source: `docs/OTT-DAMOA-MVP-v0.6.md`
- Five-person execution and ownership source:
  `docs/BACKEND-SPRINT-OWNERSHIP-v0.7.md`
- Persistence source: `docs/ERD-v0.7-baseline.md`,
  `prisma/schema.prisma`, and `prisma/migrations/**`
- `docs/ARCHITECTURE.md` and `docs/TEAM-OWNERSHIP.md` summarize those sources
  and have lower priority.

The v0.7 Day 1 baseline provides the anonymous-MVP contracts, adapter/config
types, composition types, and Run·Trace-only Prisma schema/migration. The
existing Demo runtime still uses deprecated authentication/profile/engagement
contracts while the five vertical slices are developed. That transitional code
is a compile/run compatibility path, not the target product scope. Do not add
new login, profile, MY, saved, watched, or backend not-interested behavior.
Removal belongs to the ordered role work in the v0.7 ownership document.

## Start here

- Use Node.js 22.13 or newer and npm.
- Windows: `npm.cmd ci`, then `npm.cmd run dev`.
- macOS/Linux: `npm ci`, then `npm run dev`.
- Open `http://localhost:3000`.
- Do not create `.env.local` for the default Demo.

The default Demo must run without credentials, a database, Supabase, pgvector,
or OpenAI.

## Required checks

Before handing work off, run:

- `npm run db:validate`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

`db:validate` uses a local validation-only URL inside the Prisma CLI child
process and does not connect to a database. Selecting a real Prisma Run or
Trace store still requires actual `DATABASE_URL` and `DIRECT_URL` values at the
runtime config boundary.

The current integration suite retains legacy Demo regression coverage until
the vertical-slice cleanup merges. `tests/baseline-contract.test.mjs` and
`tests/v07-baseline.type-test.ts` are the v0.7 baseline gates.

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
- The active Prisma schema contains only `RecommendationRun` and `AgentTrace`.
- Never persist user identity, natural-language source text, raw tokens,
  matched terms, prompts, secrets, or backend engagement state in Run/Trace.

Read `docs/ARCHITECTURE.md` before changing a shared contract or composition
boundary.

## Active v0.7 ownership

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
- Branch from the accepted v0.7 baseline on `dev`.
- Push only a feature branch and open a pull request into `dev`.
- Do not push directly to `dev` or `main` unless you are the repository owner.
- Keep secrets in `.env.local`; add variable names only to `.env.example`.
- Do not commit generated logs, build output, credentials, tokens, database
  URLs, or personal environment files.
