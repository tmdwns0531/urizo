# OTT Damoa agent guide

This repository is designed so a human teammate or coding LLM can clone it and run the complete Demo without credentials, a database, Supabase, pgvector, or OpenAI.

## Start here

- Use Node.js 22.13 or newer and npm.
- Windows: `npm.cmd ci`, then `npm.cmd run dev`.
- macOS/Linux: `npm ci`, then `npm run dev`.
- Open `http://localhost:3000`.
- Do not create `.env.local` for the default Demo.

## Required checks

Before handing work off, run:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

`npm run test` builds the app and exercises normal, approval, rejection, policy-block, budget-fallback, replacement, engagement, ownership, and reset flows.

## Architecture invariants

- Dependency direction: `app -> domains -> contracts`.
- Concrete integrations are injected only from `src/composition`.
- Keep the default path fully local: demo auth, fixture catalog, local search, deterministic selection, and memory stores.
- Validate only the environment variables required by a selected Live adapter.
- Do not import Prisma, Auth.js, OpenAI, or other Live SDKs from the default Demo path.
- Do not add a public `/api/search`; recommendation orchestration calls search through its server-side contract.
- Executors and future agents must remain inside policy, budget, approval, tool-registry, final-filter, and trace boundaries.
- Never weaken age, provider, runtime, watched, not-interested, or replacement safety filters to make a test pass.

## Ownership

- A: authentication, users, login, onboarding, profile
- B: catalog, TMDB, OTT links, Prisma, migrations, seeds
- C: CHOICE, query construction, embeddings, pgvector, mood tagging
- D: recommendation, scoring, policy, approval, trace, replacement, agents
- E: engagement, MY, events, shared UI

Read `docs/ARCHITECTURE.md` and `docs/TEAM-OWNERSHIP.md` before changing a shared contract or composition boundary.

## Git workflow

- Branch from `dev`.
- Push only your feature branch.
- Open a pull request into `dev`.
- Do not push directly to `dev` or `main` unless you are the repository owner.
- Keep secrets in `.env.local`; add variable names only to `.env.example`.
- Do not commit generated logs, build output, credentials, tokens, or personal environment files.