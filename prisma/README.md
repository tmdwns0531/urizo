# Prisma Live database

`schema.prisma` is the persistence contract for future Live adapters. It is not
part of the environment-free Demo boot path. Demo composition must not import
`@prisma/client`, read `DATABASE_URL`, or execute a migration.

## Live setup rules

1. Select at least one Prisma-backed adapter explicitly.
2. Supply `DATABASE_URL` and `DIRECT_URL` only in local secret storage or the
   deployment environment. Never commit their values.
3. In the shared Supabase development project, use the developer-specific
   schema selected by the connection string. The database owner reviews every
   migration before it reaches a shared schema.
4. Enable pgvector once for the database and merge
   [`sql/pgvector.sql`](sql/pgvector.sql) into the initial, reviewed migration:
   the extension statement precedes table creation and the custom indexes
   follow table creation.
5. Generate the Prisma client only for Live development and run a smoke test
   that writes a 1,536-dimensional vector and performs a parameterized cosine
   similarity query.

## Contract mapping

The Live repositories preserve the current contract shapes without lossy
renaming:

- `CatalogContent.productionCountries`, `companionTags`, and `backdropColor`
  map to the same-named `Content` fields.
- `RecommendationRun.excludedContentIds` and `replacedContentIds` map to the
  corresponding run arrays.
- `RecommendationRun.policySubjectUserId` stores the user context whose safety
  policy governed the run.
- `RecommendationItem.reasons` remains a string array.
- `EngagementEvent.type` uses `BOOKMARK`, `UNBOOKMARK`, `WATCHED`,
  `NOT_INTERESTED`, and `OTT_CLICK` in both the contract and Prisma enum.

The embedding column is nullable because Prisma cannot write an
`Unsupported("vector(1536)")` value through ordinary generated CRUD input.
Ingestion and similarity search therefore use parameterized Prisma raw SQL.
The application must reject any vector whose dimension is not exactly 1,536.

The HNSW cosine index is a production-growth index. PostgreSQL may reasonably
prefer a sequential scan for the small MVP fixture/catalog size.
