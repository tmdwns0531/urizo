# Prisma LIVE persistence

The credential-free Demo uses memory repositories and must not load Prisma.
Prisma is created only after a selected LIVE capability has passed environment
validation.

## Migration order

1. `20260731090000_v07_run_trace_baseline` creates only anonymous
   `RecommendationRun` and append-only `AgentTrace` storage.
2. `20260731160000_v08_live_catalog_vector` additively introduces the internal
   Trace sequence counter, normalized catalog/provider tables, versioned search
   documents, `vector(1536)` embeddings, and the cosine HNSW index.
3. `20260802090000_v09_bounded_agent_multiturn` replaces the Run lifecycle
   CHECK so a pre-search FAMILY clarification can remain unmaterialized while a
   runtime-relaxation approval remains materialized.
4. `20260803062000_v09_lifecycle_shape_atomic_hardening` atomically
   re-establishes that CHECK and rejects malformed JSON shapes whose predicate
   would otherwise evaluate to SQL null.

Never edit or squash an existing migration. On an authorized Node-based
operator machine, supply rotated `DATABASE_URL` and `DIRECT_URL` values through
the ignored `.env.local`:

```powershell
npm.cmd run db:validate
npm.cmd run db:generate
npm.cmd run db:migrate:deploy
```

`db:validate` uses a validation-only loopback URL and does not connect to a
database. `migrate deploy` requires both database URLs and is the command that
changes the selected database;
review its target before running it. The v0.8 migration enables pgvector in the
`extensions` schema. If an existing database installed `vector` in another
schema, align the extension location before deployment rather than editing the
accepted migration after it has run. The unapplied v0.8 SQL is wrapped in one
PostgreSQL transaction so an intermediate DDL or permission failure rolls back.
The immutable v0.9 multiturn migration drops and adds the lifecycle CHECK
without an explicit transaction. Its additive hardening migration performs the
canonical replacement inside one transaction, but cannot make an earlier v0.9
failure atomic retroactively. Review the detailed
[atomicity finding](../docs/V09-MIGRATION-ATOMICITY-REVIEW.md) before deployment.

No migration or repository stores User, Profile, Auth, Engagement, source user
text, prompts, raw tokens, matched terms, API responses, or credentials.

## Generated clients and Worker factory

The schema uses two Prisma 6.19 `prisma-client` generators with
`engineType = "client"`:

- `src/generated/prisma-workerd/client` uses the Workerd WASM query compiler;
- `src/generated/prisma-node/client` is for authorized Node batch jobs.

Both generated directories are ignored because they contain machine-specific
generator metadata and generated WASM. A clean clone must generate them before
typecheck or build:

```powershell
npm.cmd ci
npm.cmd run db:generate
npm.cmd run typecheck
```

Composition should dynamically import the factory only after a Prisma-backed
capability and its connection string have been validated. The factory itself
uses literal imports of the generated Workerd client and `PrismaPg`, reads no
environment variables, and creates no global cache:

```ts
const { createPrismaLiveAdapters } = await import(
  "../adapters/prisma/factory"
);
const prisma = createPrismaLiveAdapters(validatedDatabaseUrl);
```

The caller owns the returned lifecycle and must call `disconnect()` when the
composition/request lifecycle ends. The bundle also exposes `runs`, `traces`,
`catalog`, and `embeddings`. A sanitized `RUNNING` row is written before
catalog, search, or model work.
`execution_mode`, `input_fingerprint`, and `query_vector` use SQL NULL until
a real continuation exists; no placeholder vector or fingerprint is written.
`FAMILY_COMPOSITION` awaiting rows are pre-search and require SQL NULL mode,
fingerprint, and vector. `RUNTIME_RELAXATION` awaiting rows and completed rows
require all three materialized fields. Failed rows store only the allowlisted
error state and completion time. Run CAS and each Trace batch commit in the same
transaction, including sequence allocation.

## Catalog ingestion and embeddings

TMDB is a batch ingestion source, not a request-time catalog adapter. Runtime
recommendations read `PrismaCatalogRepository`; they never call TMDB directly.
The explicit entry point is:

```ts
runTmdbCatalogIngestion({
  credential: { kind: "bearer", value: tmdbCredential },
  fetchImpl: globalThis.fetch,
  writer: prisma.catalog,
  pages: 1,
});
```

`tmdbCredential` is supplied by the caller and is never logged or returned.
Normalization keeps only the six public providers, uses SEARCH or HOME links
when TMDB cannot prove a provider-native DIRECT URL, rejects items without a
positive runtime/year or allowed Korean provider, and maps an absent or
unrecognized Korean certification to `UNKNOWN`. Upsert is idempotent by
TMDB/media identity and content hash. Raw TMDB responses are discarded.

After catalog ingestion, an injected embedding generator can fill pending
search documents:

```ts
runPendingCatalogEmbeddings({
  repository: prisma.embeddings,
  generator: openAiEmbeddingClient,
  model: "text-embedding-3-small",
  batchSize: 25,
});
```

The repository enforces exactly 1536 finite numbers before writing a vector.
The exported runners read no environment themselves. The package-level Node
entrypoints load ignored `.env.local`, validate only required names, log only
aggregate counts, and always disconnect the Node Prisma client.

## Parameterized SQL

pgvector is an unsupported Prisma scalar, so vector write/search statements are
constant SQL with separately bound values. Vector arrays are validated, then
serialized to pgvector's numeric literal and bound to `$n::extensions.vector`.
Candidate IDs are bound as `text[]`, model and dimensions are bound scalars,
and limits are range-checked integers. Never concatenate request text, IDs,
model names, vector values, or limits into SQL.

`$executeRawUnsafe`/`$queryRawUnsafe` appear only because Prisma cannot express
the pgvector scalar through generated CRUD. The SQL string is a module
constant; every runtime value is still a driver parameter.

## Local and Worker limitations

The LIVE factory uses the generated `runtime = "workerd"` client, Prisma's
JavaScript query compiler (`engineType = "client"`), and `PrismaPg`. The
project already enables Cloudflare `nodejs_compat`, which `pg` needs for its
Node-compatible TCP APIs. The selected database endpoint must still be
reachable from the Worker and its connection/pooling limits must be reviewed;
client generation alone does not make an arbitrary private PostgreSQL endpoint
reachable.

Node migration and ingestion processes may import the separately generated
`src/generated/prisma-node/client`. TMDB ingestion and catalog embedding remain
operator/batch jobs and must not run inside page/API requests. The Demo path
must not import the factory module eagerly or initialize a database adapter.
