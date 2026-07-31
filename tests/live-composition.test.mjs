import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("LIVE composition owns Prisma per request and every route disposes it", async () => {
  const [live, composition, types, vite, packageSource, liveRunner] =
    await Promise.all([
      read("src/composition/live.ts"),
      read("src/composition/index.ts"),
      read("src/composition/types.ts"),
      read("vite.config.ts"),
      read("package.json"),
      read("scripts/run-live-dev.mjs"),
    ]);
  assert.match(
    live,
    /createPrismaLiveAdapters\(\s*requiredEnvironmentValue\(env, "DATABASE_URL"\)/,
  );
  assert.match(live, /await prismaBundle\.disconnect\(\)/);
  assert.match(types, /dispose\(\): Promise<void>/);
  assert.match(composition, /if \(usesPrisma\(config\)\) \{/);
  assert.match(
    composition,
    /return createMvpComposition\(\{ config, env, demoAdapters \}\)/,
  );
  assert.match(composition, /finally \{\s*await composition\.dispose\(\)/);
  assert.match(vite, /compatibility_date: WORKER_COMPATIBILITY_DATE/);
  assert.match(vite, /"nodejs_compat_populate_process_env"/);
  assert.match(vite, /OTT_DAMOA_PROFILE_OVERRIDE: "live"/);
  assert.match(vite, /process\.env\.OTT_DAMOA_PROFILE_OVERRIDE/);

  const packageJson = JSON.parse(packageSource);
  assert.match(packageJson.scripts["dev:live"], /run-live-dev\.mjs/);
  assert.doesNotMatch(packageJson.scripts["dev:live"], /--mode/);
  assert.match(liveRunner, /import\.meta\.resolve\("vinext"\)/);
  assert.match(liveRunner, /OTT_DAMOA_PROFILE_OVERRIDE: "live"/);
  assert.ok(packageJson.scripts.postinstall.includes("prisma-generate"));
  assert.ok(packageJson.scripts["db:migrate:deploy"]);
  assert.ok(packageJson.scripts["live:catalog:ingest"]);
  assert.ok(packageJson.scripts["live:catalog:embed"]);

  const routes = await Promise.all([
    read("src/app/api/health/route.ts"),
    read("src/app/api/recommendations/route.ts"),
    read("src/app/api/recommendations/[runId]/route.ts"),
    read("src/app/api/recommendations/[runId]/approval/route.ts"),
    read("src/app/api/recommendations/[runId]/replacement/route.ts"),
    read("src/app/api/demo/reset/route.ts"),
  ]);
  for (const route of routes) {
    assert.match(route, /withMvpComposition/);
    assert.doesNotMatch(route, /getComposition/);
  }

  const health = routes[0];
  assert.match(health, /satisfies HealthResponse/);
  assert.match(health, /adapters\.catalog\.list\(\)/);
  assert.match(health, /adapters\.runs\.get\(HEALTH_PROBE_RUN_ID\)/);
  assert.match(health, /adapters\.traces\.listStored\(HEALTH_PROBE_RUN_ID\)/);
  assert.match(health, /"not_checked"/);
});

test("operator batch entrypoints keep secrets out of output", async () => {
  const [ingest, embed, batchFactory] = await Promise.all([
    read("scripts/live-ingest-tmdb.ts"),
    read("scripts/live-embed-catalog.ts"),
    read("src/adapters/prisma/node-factory.ts"),
  ]);
  assert.match(batchFactory, /generated\/prisma-node\/client/);
  assert.match(batchFactory, /new PrismaPg\(\{ connectionString \}\)/);
  for (const source of [ingest, embed]) {
    assert.match(source, /finally \{/);
    assert.match(source, /await prisma\.disconnect\(\)/);
    assert.doesNotMatch(source, /console\.(?:log|error)\([^\n]*process\.env/);
  }
  assert.match(embed, /if \(report\.remaining\)/);
  assert.match(embed, /CATALOG_EMBED_INCOMPLETE/);
  assert.match(embed, /process\.exitCode = 2/);
});