import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const withoutComments = (sql) => sql.replace(/--.*$/gm, "").trim();

test("v0.9 corrective migration atomically reinstates the lifecycle CHECK", async () => {
  const [original, corrective] = await Promise.all([
    read(
      "prisma/migrations/20260802090000_v09_bounded_agent_multiturn/migration.sql",
    ),
    read(
      "prisma/migrations/20260803062000_v09_lifecycle_shape_atomic_hardening/migration.sql",
    ),
  ]);
  const originalSql = withoutComments(original);
  const correctiveSql = withoutComments(corrective);

  assert.doesNotMatch(originalSql, /^BEGIN;/);
  assert.ok(
    originalSql.indexOf("DROP CONSTRAINT") <
      originalSql.indexOf("ADD CONSTRAINT"),
  );

  assert.match(correctiveSql, /^BEGIN;/);
  assert.match(correctiveSql, /COMMIT;$/);
  assert.equal((correctiveSql.match(/\bBEGIN;/g) ?? []).length, 1);
  assert.equal((correctiveSql.match(/\bCOMMIT;/g) ?? []).length, 1);
  assert.ok(
    correctiveSql.indexOf("DROP CONSTRAINT IF EXISTS") <
      correctiveSql.indexOf("ADD CONSTRAINT"),
  );
  assert.match(correctiveSql, /\) IS TRUE\s*\n\s*\);/);
});

test("v0.9 corrective CHECK preserves both approval continuation shapes", async () => {
  const migration = await read(
    "prisma/migrations/20260803062000_v09_lifecycle_shape_atomic_hardening/migration.sql",
  );
  const familyShape = migration.match(
    /'FAMILY_COMPOSITION'[\s\S]*?"query_vector" IS NULL/,
  )?.[0];
  const runtimeShape = migration.match(
    /'RUNTIME_RELAXATION'[\s\S]*?"query_vector" IS NOT NULL/,
  )?.[0];

  assert.ok(familyShape);
  assert.match(familyShape, /"execution_mode" IS NULL/);
  assert.match(familyShape, /"input_fingerprint" IS NULL/);
  assert.match(familyShape, /"query_vector" IS NULL/);

  assert.ok(runtimeShape);
  assert.match(runtimeShape, /"execution_mode" IS NOT NULL/);
  assert.match(runtimeShape, /"input_fingerprint" IS NOT NULL/);
  assert.match(runtimeShape, /"query_vector" IS NOT NULL/);
});
