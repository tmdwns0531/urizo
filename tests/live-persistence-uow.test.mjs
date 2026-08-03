import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const load = (relativePath) =>
  jiti.import(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)));

const traceEvent = (title) => ({
  action: "complete",
  visibility: "PUBLIC",
  publicMessage: title,
  detail: { title, description: title },
  durationMs: null,
});

const storedRun = (id = "run_uow") => {
  const now = "2026-07-31T00:00:00.000Z";
  return {
    id,
    status: "COMPLETED",
    revision: 0,
    executionMode: "DETERMINISTIC",
    inputFingerprint: `sha256:${"a".repeat(64)}`,
    requestSnapshot: {
      selectedProviders: ["NETFLIX"],
      companions: ["ANY"],
      moods: [],
      desiredGenres: [],
      companionAvoidGenres: [],
      maxRuntimeMinutes: null,
      originPreference: "ANY",
      hasNaturalLanguage: false,
    },
    queryVector: {
      algorithm: "local-hash-cosine-v1",
      version: 1,
      dimensions: 64,
      values: Array(64).fill(0),
    },
    responseSnapshot: {
      status: "completed",
      runId: id,
      recommendations: [],
      topPick: null,
      fallbackUsed: false,
      policyBlockedCount: 0,
      createdAt: now,
      updatedAt: now,
    },
    excludedContentIds: [],
    replacedContentIds: [],
    candidateCount: 0,
    resultCount: 0,
    modelCallCount: 0,
    toolCallCount: 0,
    totalTokens: 0,
    durationMs: 0,
    policyBlockCount: 0,
    fallbackReason: null,
    errorCode: null,
    startedAt: now,
    completedAt: now,
    createdAt: now,
    updatedAt: now,
  };
};

test("memory UoW commits Run CAS and a contiguous Trace batch together", async () => {
  const [runModule, traceModule, persistenceModule] = await Promise.all([
    load("src/adapters/memory/memory-run-repository.ts"),
    load("src/adapters/memory/memory-trace-repository.ts"),
    load("src/adapters/memory/memory-recommendation-persistence.ts"),
  ]);
  const runs = new runModule.MemoryRunRepository();
  const traces = new traceModule.MemoryTraceRepository();
  const persistence =
    new persistenceModule.MemoryRecommendationPersistenceUnitOfWork(
      runs,
      traces,
    );
  const run = storedRun();

  await persistence.createRunWithTraceEvents(run, [
    traceEvent("one"),
    traceEvent("two"),
  ]);
  assert.deepEqual(
    (await traces.listStored(run.id)).map(({ sequence }) => sequence),
    [1, 2],
  );

  const updated = await persistence.updateRunWithTraceEvents(
    run.id,
    0,
    { resultCount: 1 },
    [traceEvent("three")],
  );
  assert.equal(updated.ok, true);
  assert.equal((await runs.get(run.id)).revision, 1);
  assert.deepEqual(
    (await traces.listStored(run.id)).map(({ sequence }) => sequence),
    [1, 2, 3],
  );

  const stale = await persistence.updateRunWithTraceEvents(
    run.id,
    0,
    { resultCount: 2 },
    [traceEvent("must-not-append")],
  );
  assert.deepEqual(stale, { ok: false, reason: "REVISION_CONFLICT" });
  assert.equal((await traces.listStored(run.id)).length, 3);
});

test("Prisma UoW keeps Run CAS, sequence allocation, and Trace writes in one transaction", async () => {
  const source = await readFile(
    new URL(
      "../src/adapters/prisma/prisma-recommendation-persistence.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /client\.\$transaction/);
  assert.match(source, /recommendationRun\.updateMany/);
  assert.match(
    source,
    /nextTraceSequence:\s*\{ increment: events\.length \}/,
  );
  assert.match(source, /insertTraceBatch\(transaction/);
  assert.doesNotMatch(source, /this\.client\.agentTrace/);

  const orchestrator = await readFile(
    new URL("../src/domains/recommendation/orchestrator.ts", import.meta.url),
    "utf8",
  );
  assert.equal(
    [...orchestrator.matchAll(/persistence\.updateRunWithTraceEvents/g)].length,
    9,
  );
  assert.doesNotMatch(orchestrator, /appendTraceEvents/);
});
