# Contributing

## Clone and run

```bash
git clone https://github.com/tmdwns0531/urizo.git
cd urizo
npm ci
npm run dev
```

Windows PowerShell users can run `npm.cmd` instead of `npm`.

The Demo must start without `.env.local`. Visit `http://localhost:3000` and use the CHOICE Demo Lab to verify normal, approval, policy-block, and budget fallback scenarios.

## Branch and pull request flow

1. Update `dev`: `git switch dev && git pull`.
2. Create a branch: `git switch -c feature/<short-topic>`.
3. Make a focused change and run the required checks.
4. Push only the feature branch.
5. Open a pull request with base branch `dev`.
6. Resolve review threads and obtain the required approval.

Team members must not push directly to `dev` or `main`. The repository owner `tmdwns0531` manages protected-branch updates and release promotion from `dev` to `main`.

## Pull request checklist

- Demo still runs without external credentials.
- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm run test` passes.
- `npm run build` passes.
- Shared contracts and ownership docs are updated when boundaries change.
- `.env.example` contains names only; no secret value is committed.
- The default path contains no unfinished Live adapter import.