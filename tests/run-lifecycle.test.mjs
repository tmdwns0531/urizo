import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const load = (relativePath) =>
  jiti.import(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)));

const defaultContinuation = {
  queryVector: {
    algorithm: "local-hash-cosine-v1",
    version: 1,
    dimensions: 64,
    values: Array(64).fill(0),
  },
  inputFingerprint: `sha256:${"a".repeat(64)}`,
};

const recommendationRequest = (naturalLanguage) => ({
  choice: {
    selectedProviders: ["NETFLIX"],
    companions: ["ANY"],
    moods: [],
    desiredGenres: [],
    companionAvoidGenres: [],
    maxRuntimeMinutes: 60,
    originPreference: "ANY",
    ...(naturalLanguage ? { naturalLanguage } : {}),
  },
});

const approvalRequest = {
  choice: {
    selectedProviders: ["NETFLIX"],
    companions: ["ANY"],
    moods: [],
    desiredGenres: [],
    companionAvoidGenres: [],
    maxRuntimeMinutes: 30,
    originPreference: "ANY",
  },
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const traceEvent = (action) => ({
  action,
  visibility: "PUBLIC",
  publicMessage: `${action} public`,
  detail: {
    title: `${action} title`,
    description: `${action} public`,
  },
  durationMs: null,
});

const executionResult = (continuation = defaultContinuation) => ({
  ranked: [],
  selected: [],
  excludedContentIds: [],
  eligibleCount: 0,
  continuation,
  executionMode: "DETERMINISTIC",
  fallbackUsed: false,
  fallbackReason: null,
  budgetSnapshot: {
    modelCalls: 0,
    toolCalls: 0,
    tokens: 0,
    elapsedMs: 1,
  },
  durationMs: 1,
});

const completedPolicyResult = (continuation = defaultContinuation) => ({
  status: "completed",
  recommendations: [],
  execution: executionResult(continuation),
  policyBlockedCount: 0,
  traceEvents: [traceEvent("complete")],
});

const awaitingPolicyResult = () => ({
  status: "awaiting_approval",
  proposal: {
    kind: "RUNTIME_RELAXATION",
    currentMaxMinutes: 30,
    proposedMaxMinutes: 45,
    currentCandidateCount: 0,
    question: "45분까지 넓힐까요?",
    approveLabel: "승인",
    rejectLabel: "거절",
  },
  partialRecommendations: [],
  execution: executionResult(),
  policyBlockedCount: 0,
  traceEvents: [traceEvent("approval_request")],
});

async function createHarness(policy, options = {}) {
  const [orchestratorModule, runModule, traceModule, persistenceModule] =
    await Promise.all([
      load("src/domains/recommendation/orchestrator.ts"),
      load("src/adapters/memory/memory-run-repository.ts"),
      load("src/adapters/memory/memory-trace-repository.ts"),
      load("src/adapters/memory/memory-recommendation-persistence.ts"),
    ]);
  const runs = new runModule.MemoryRunRepository();
  const traces = new traceModule.MemoryTraceRepository();
  const memoryPersistence =
    new persistenceModule.MemoryRecommendationPersistenceUnitOfWork(
      runs,
      traces,
    );
  const calls = [];
  let createdRunId = null;
  const persistence = {
    async createRunWithTraceEvents(run, events) {
      createdRunId = run.id;
      calls.push({ kind: "create", run: structuredClone(run), events });
      return memoryPersistence.createRunWithTraceEvents(run, events);
    },
    async updateRunWithTraceEvents(runId, revision, patch, events) {
      calls.push({
        kind: "update",
        runId,
        revision,
        patch: structuredClone(patch),
        events,
      });
      if (options.failFailurePersistence && patch.status === "FAILED") {
        throw new Error("secondary persistence failure");
      }
      return memoryPersistence.updateRunWithTraceEvents(
        runId,
        revision,
        patch,
        events,
      );
    },
  };
  const orchestrator = new orchestratorModule.AnonymousRecommendationOrchestrator({
    appProfile: "demo",
    catalog: {
      async list() {
        return [];
      },
      async getById() {
        return null;
      },
    },
    executor: {
      async execute() {
        throw new Error("fake policy must not call the executor");
      },
    },
    policy,
    runs,
    traces,
    persistence,
  });

  return {
    orchestrator,
    runs,
    traces,
    calls,
    get createdRunId() {
      return createdRunId;
    },
  };
}

test("initial execution is observable as sanitized RUNNING before terminal persistence", async () => {
  const policyStarted = deferred();
  const resultGate = deferred();
  const harness = await createHarness({
    async execute() {
      policyStarted.resolve();
      return resultGate.promise;
    },
  });
  const naturalLanguage = "private-natural-language-canary";
  const recommendation = harness.orchestrator.recommend(
    recommendationRequest(naturalLanguage),
  );

  await policyStarted.promise;
  assert.ok(harness.createdRunId);
  const running = await harness.runs.get(harness.createdRunId);
  assert.equal(running.status, "RUNNING");
  assert.equal(running.revision, 0);
  assert.equal(running.executionMode, null);
  assert.equal(running.inputFingerprint, null);
  assert.equal(running.queryVector, null);
  assert.equal(running.responseSnapshot, null);
  assert.equal(running.completedAt, null);
  assert.doesNotMatch(JSON.stringify(running), new RegExp(naturalLanguage));
  await assert.rejects(
    () => harness.orchestrator.getRun(harness.createdRunId),
    /not ready for public access/,
  );

  resultGate.resolve(completedPolicyResult());
  const response = await recommendation;
  assert.equal(response.status, "completed");
  const completed = await harness.runs.get(harness.createdRunId);
  assert.equal(completed.status, "COMPLETED");
  assert.equal(completed.revision, 1);
  assert.equal(completed.executionMode, "DETERMINISTIC");
  assert.deepEqual(completed.queryVector, defaultContinuation.queryVector);
  assert.equal(completed.inputFingerprint, defaultContinuation.inputFingerprint);
  assert.equal(completed.responseSnapshot.status, "completed");
  assert.ok(completed.completedAt);
});

test("initial execution failure is sanitized as FAILED and FAILED wins public projection", async () => {
  const originalError = new Error("raw-provider-error-canary");
  const naturalLanguage = "raw-natural-language-canary";
  const harness = await createHarness({
    async execute() {
      throw originalError;
    },
  });

  await assert.rejects(
    harness.orchestrator.recommend(recommendationRequest(naturalLanguage)),
    (error) => error === originalError,
  );
  const failed = await harness.runs.get(harness.createdRunId);
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.revision, 1);
  assert.equal(failed.executionMode, null);
  assert.equal(failed.queryVector, null);
  assert.equal(failed.inputFingerprint, null);
  assert.equal(failed.responseSnapshot, null);
  assert.equal(failed.errorCode, "INTERNAL_ERROR");
  assert.ok(failed.completedAt);
  assert.doesNotMatch(JSON.stringify(failed), /raw-provider-error-canary/);
  assert.doesNotMatch(JSON.stringify(failed), new RegExp(naturalLanguage));
  assert.deepEqual(await harness.traces.listStored(harness.createdRunId), []);
  await assert.rejects(
    () => harness.orchestrator.getRun(harness.createdRunId),
    /failed safely/,
  );
});

test("failure persistence cannot mask the original execution error", async () => {
  const originalError = new Error("original execution failure");
  const harness = await createHarness(
    {
      async execute() {
        throw originalError;
      },
    },
    { failFailurePersistence: true },
  );

  await assert.rejects(
    harness.orchestrator.recommend(recommendationRequest()),
    (error) => error === originalError,
  );
  assert.equal((await harness.runs.get(harness.createdRunId)).status, "RUNNING");
});

test("approval is persisted as AWAITING_APPROVAL to RUNNING to COMPLETED", async () => {
  const approvalStarted = deferred();
  const approvalGate = deferred();
  let invocation;
  let callCount = 0;
  const harness = await createHarness({
    async execute(_runId, nextInvocation) {
      callCount += 1;
      if (callCount === 1) return awaitingPolicyResult();
      invocation = nextInvocation;
      approvalStarted.resolve();
      return approvalGate.promise;
    },
  });

  const awaiting = await harness.orchestrator.recommend(approvalRequest);
  assert.equal(awaiting.status, "awaiting_approval");
  assert.equal((await harness.runs.get(awaiting.runId)).revision, 1);

  const approval = harness.orchestrator.decideApproval(awaiting.runId, "approve");
  await approvalStarted.promise;
  const running = await harness.runs.get(awaiting.runId);
  assert.equal(running.status, "RUNNING");
  assert.equal(running.revision, 2);
  assert.equal(running.responseSnapshot, null);
  assert.equal(running.requestSnapshot.maxRuntimeMinutes, 45);
  assert.ok(running.inputFingerprint.startsWith("sha256:"));
  assert.deepEqual(
    (await harness.traces.listStored(awaiting.runId)).map(({ action }) => action),
    ["approval_request", "approval_decision"],
  );
  await assert.rejects(
    () => harness.orchestrator.getRun(awaiting.runId),
    /not ready for public access/,
  );

  approvalGate.resolve(completedPolicyResult(invocation.continuation));
  const completedResponse = await approval;
  assert.equal(completedResponse.status, "completed");
  const completed = await harness.runs.get(awaiting.runId);
  assert.equal(completed.status, "COMPLETED");
  assert.equal(completed.revision, 3);
  assert.equal(completed.requestSnapshot.maxRuntimeMinutes, 45);
  assert.equal(completed.inputFingerprint, invocation.continuation.inputFingerprint);
});

test("approval execution failure transitions RUNNING to sanitized FAILED", async () => {
  const originalError = new Error("approval-provider-error-canary");
  let callCount = 0;
  const harness = await createHarness({
    async execute() {
      callCount += 1;
      if (callCount === 1) return awaitingPolicyResult();
      throw originalError;
    },
  });
  const awaiting = await harness.orchestrator.recommend(approvalRequest);

  await assert.rejects(
    harness.orchestrator.decideApproval(awaiting.runId, "approve"),
    (error) => error === originalError,
  );
  const failed = await harness.runs.get(awaiting.runId);
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.revision, 3);
  assert.equal(failed.responseSnapshot, null);
  assert.equal(failed.errorCode, "INTERNAL_ERROR");
  assert.doesNotMatch(JSON.stringify(failed), /approval-provider-error-canary/);
  assert.deepEqual(
    (await harness.traces.listStored(awaiting.runId)).map(({ action }) => action),
    ["approval_request", "approval_decision"],
  );
});

test("concurrent approval CAS permits one execution and one approval trace", async () => {
  const approvalStarted = deferred();
  const approvalGate = deferred();
  let approvalInvocation;
  let callCount = 0;
  let approvalExecutions = 0;
  const harness = await createHarness({
    async execute(_runId, invocation) {
      callCount += 1;
      if (callCount === 1) return awaitingPolicyResult();
      approvalExecutions += 1;
      approvalInvocation = invocation;
      approvalStarted.resolve();
      return approvalGate.promise;
    },
  });
  const awaiting = await harness.orchestrator.recommend(approvalRequest);

  const settledPromise = Promise.allSettled([
    harness.orchestrator.decideApproval(awaiting.runId, "approve"),
    harness.orchestrator.decideApproval(awaiting.runId, "approve"),
  ]);
  await approvalStarted.promise;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(approvalExecutions, 1);
  approvalGate.resolve(completedPolicyResult(approvalInvocation.continuation));

  const settled = await settledPromise;
  assert.deepEqual(
    settled.map(({ status }) => status).sort(),
    ["fulfilled", "rejected"],
  );
  const rejected = settled.find(({ status }) => status === "rejected");
  assert.equal(rejected.reason.name, "RecommendationRevisionConflictError");
  assert.equal(
    (await harness.traces.listStored(awaiting.runId)).filter(
      ({ action }) => action === "approval_decision",
    ).length,
    1,
  );
  assert.equal((await harness.runs.get(awaiting.runId)).status, "COMPLETED");
});

test("Prisma lifecycle schema and mapper preserve SQL NULL staging semantics", async () => {
  const [schema, migration, mapper] = await Promise.all([
    readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../prisma/migrations/20260731160000_v08_live_catalog_vector/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL("../src/adapters/prisma/mappers.ts", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(schema, /executionMode\s+RecommendationExecutionMode\?/);
  assert.match(schema, /inputFingerprint\s+String\?/);
  assert.match(schema, /queryVector\s+Json\?/);
  assert.match(migration, /recommendation_runs_lifecycle_shape_check/);
  assert.match(migration, /ALTER COLUMN "query_vector" DROP NOT NULL/);
  assert.match(migration, /"status" = 'RUNNING'[\s\S]*"response_snapshot" IS NULL/);
  assert.match(migration, /"status" = 'FAILED'[\s\S]*"error_code" IN/);
  assert.match(mapper, /value === null \? Prisma\.DbNull/);
  assert.match(mapper, /record\.queryVector === null\s*\? null/);
  assert.match(mapper, /record\.responseSnapshot === null\s*\? null/);

  const mapperModule = await load("src/adapters/prisma/mappers.ts");
  const now = new Date("2026-07-31T00:00:00.000Z");
  const mapped = mapperModule.mapPrismaRun({
    id: "run_mapper_probe",
    status: "RUNNING",
    revision: 0,
    nextTraceSequence: 1,
    executionMode: null,
    inputFingerprint: null,
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
    queryVector: null,
    responseSnapshot: null,
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
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  assert.equal(mapped.queryVector, null);
  assert.equal(mapped.responseSnapshot, null);

  const createData = mapperModule.mapRunForCreate(mapped);
  assert.equal(createData.queryVector.constructor.name, "DbNull");
  assert.equal(createData.responseSnapshot.constructor.name, "DbNull");
});