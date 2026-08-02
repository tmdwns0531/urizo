import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { moduleCache: false });
const load = (relativePath) =>
  jiti.import(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)));

const demoConfig = {
  appProfile: "demo",
  catalog: "fixture",
  search: "local",
  selector: "deterministic",
  runStore: "memory",
  traceStore: "memory",
};

const FAMILY_AGE_QUESTION =
  "함께 보는 가족 중 가장 어린 사람의 연령대를 알려주세요.";

const FAMILY_AGE_ANSWERS = [
  { value: "ADULTS_ONLY", label: "성인만" },
  { value: "CHILD_ALL", label: "미취학 아동" },
  { value: "CHILD_7", label: "초등학생" },
  { value: "CHILD_12", label: "중학생" },
  { value: "CHILD_15", label: "고등학생 이상" },
];

test("제한형 Agent는 모호한 조건에 한 번 질문하고 답변 후 searchCatalog를 호출한다", async () => {
  const { createMvpComposition } = await load("src/composition/index.ts");
  const composition = await createMvpComposition({ config: demoConfig });

  try {
    const source = "가족과 따뜻한 작품을 보고 싶어";
    const awaiting = await composition.services.recommend({
      choice: { naturalLanguage: source },
    });

    assert.equal(awaiting.status, "awaiting_approval");
    assert.equal(awaiting.proposal.kind, "FAMILY_COMPOSITION");
    assert.equal(awaiting.proposal.question, FAMILY_AGE_QUESTION);
    assert.deepEqual(awaiting.proposal.answers, FAMILY_AGE_ANSWERS);
    assert.equal(awaiting.partialRecommendations.length, 0);
    const beforeAnswer = await composition.adapters.runs.get(awaiting.runId);
    assert.equal(beforeAnswer.status, "AWAITING_APPROVAL");
    assert.equal(beforeAnswer.executionMode, null);
    assert.equal(beforeAnswer.queryVector, null);
    assert.equal(beforeAnswer.toolCallCount, 0);
    assert.deepEqual(beforeAnswer.requestSnapshot.moods, ["따뜻한"]);
    assert.doesNotMatch(JSON.stringify(beforeAnswer), new RegExp(source));

    const completed = await composition.services.decideApproval(
      awaiting.runId,
      "CHILD_12",
      source,
    );
    assert.equal(completed.status, "completed");
    assert.equal(completed.recommendations.length, 5);
    assert.ok(completed.topPick);
    const afterAnswer = await composition.adapters.runs.get(awaiting.runId);
    assert.deepEqual(afterAnswer.requestSnapshot.companions, ["WITH_CHILDREN"]);
    assert.equal(afterAnswer.requestSnapshot.childAgeRatingLimit, "12");
    assert.equal(afterAnswer.toolCallCount, 1);
    assert.ok(afterAnswer.queryVector);
    assert.ok(
      completed.trace.some(
        (event) =>
          event.action === "vector_search" &&
          event.title.includes("searchCatalog"),
      ),
      "searchCatalog 도구 호출이 Trace에 보여야 한다",
    );
    assert.ok(
      completed.trace.some(
        (event) => event.action === "select" && event.title.includes("Agent"),
      ),
      "Agent 선택이 Trace에 보여야 한다",
    );
  } finally {
    await composition.dispose();
  }
});

test("가족 연령대 답변은 기존 관람등급 안전선으로 변환한다", async () => {
  const { clarificationAnswerRatingLimit } = await load(
    "src/domains/recommendation/agent/conversation.ts",
  );

  assert.deepEqual(
    FAMILY_AGE_ANSWERS.map(({ value }) => [
      value,
      clarificationAnswerRatingLimit(value),
    ]),
    [
      ["ADULTS_ONLY", null],
      ["CHILD_ALL", "ALL"],
      ["CHILD_7", "7"],
      ["CHILD_12", "12"],
      ["CHILD_15", "15"],
    ],
  );
});

test("명확한 아이 동반 입력도 검색 전에 가장 어린 연령대를 한 번 묻는다", async () => {
  const { createMvpComposition } = await load("src/composition/index.ts");
  const composition = await createMvpComposition({ config: demoConfig });

  try {
    const source =
      "아이와 함께 2시간 안에 디즈니플러스에서 볼 영화 추천해줘";
    const awaiting = await composition.services.recommend({
      choice: { naturalLanguage: source },
    });

    assert.equal(awaiting.status, "awaiting_approval");
    assert.equal(awaiting.proposal.kind, "FAMILY_COMPOSITION");
    assert.equal(awaiting.proposal.question, FAMILY_AGE_QUESTION);
    assert.deepEqual(awaiting.proposal.answers, FAMILY_AGE_ANSWERS);
    const beforeAnswer = await composition.adapters.runs.get(awaiting.runId);
    assert.equal(beforeAnswer.toolCallCount, 0);
    assert.equal(beforeAnswer.queryVector, null);

    const completed = await composition.services.decideApproval(
      awaiting.runId,
      "CHILD_12",
      source,
    );
    assert.equal(completed.status, "completed");
    assert.ok(completed.recommendations.length > 0);
    assert.ok(
      completed.recommendations.every((item) =>
        ["ALL", "7", "12"].includes(item.content.ageRating),
      ),
    );
    const afterAnswer = await composition.adapters.runs.get(awaiting.runId);
    assert.equal(afterAnswer.requestSnapshot.childAgeRatingLimit, "12");
    assert.equal(afterAnswer.toolCallCount, 1);
  } finally {
    await composition.dispose();
  }
});

test("아이와 20분 입력은 관람등급 답변 뒤 30분 완화 승인을 이어서 묻는다", async () => {
  const { createMvpComposition } = await load("src/composition/index.ts");
  const composition = await createMvpComposition({ config: demoConfig });

  try {
    const source = "아이와 함께 20분 안에 볼 시리즈";
    const familyQuestion = await composition.services.recommend({
      choice: { naturalLanguage: source },
    });

    assert.equal(familyQuestion.status, "awaiting_approval");
    assert.equal(familyQuestion.proposal.kind, "FAMILY_COMPOSITION");
    const beforeAgeAnswer = await composition.adapters.runs.get(
      familyQuestion.runId,
    );
    assert.equal(beforeAgeAnswer.requestSnapshot.maxRuntimeMinutes, 20);
    assert.equal(beforeAgeAnswer.toolCallCount, 0);

    const runtimeQuestion = await composition.services.decideApproval(
      familyQuestion.runId,
      "CHILD_12",
      source,
    );
    assert.equal(runtimeQuestion.status, "awaiting_approval");
    assert.equal(runtimeQuestion.proposal.kind, "RUNTIME_RELAXATION");
    assert.equal(runtimeQuestion.proposal.currentMaxMinutes, 20);
    assert.equal(runtimeQuestion.proposal.proposedMaxMinutes, 30);
    assert.match(runtimeQuestion.proposal.question, /20분[\s\S]*30분/);
    assert.ok(
      runtimeQuestion.partialRecommendations.every(
        (item) => item.content.runtimeMinutes <= 20,
      ),
    );
    const afterAgeAnswer = await composition.adapters.runs.get(
      familyQuestion.runId,
    );
    assert.equal(afterAgeAnswer.requestSnapshot.maxRuntimeMinutes, 20);
    assert.equal(afterAgeAnswer.toolCallCount, 1);
    assert.ok(afterAgeAnswer.queryVector);

    const completed = await composition.services.decideApproval(
      familyQuestion.runId,
      "approve",
    );
    assert.equal(completed.status, "completed");
    assert.ok(completed.recommendations.length > 0);
    assert.ok(
      completed.recommendations.every(
        (item) => item.content.runtimeMinutes <= 30,
      ),
    );
    const afterRuntimeApproval = await composition.adapters.runs.get(
      familyQuestion.runId,
    );
    assert.equal(afterRuntimeApproval.requestSnapshot.maxRuntimeMinutes, 30);
    assert.equal(afterRuntimeApproval.toolCallCount, 2);
  } finally {
    await composition.dispose();
  }
});

test("멀티턴 migration은 질문 전 미검색 상태와 검색 후 승인 상태를 구분한다", async () => {
  const migration = await readFile(
    new URL(
      "../prisma/migrations/20260802090000_v09_bounded_agent_multiturn/migration.sql",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(migration, /FAMILY_COMPOSITION/);
  assert.match(migration, /"execution_mode" IS NULL/);
  assert.match(migration, /"query_vector" IS NULL/);
  assert.match(migration, /RUNTIME_RELAXATION/);
  assert.match(migration, /"query_vector" IS NOT NULL/);
});

test("Agent가 허용 후보 밖의 ID를 선택하면 룰 기반 1위로 fallback한다", async () => {
  const [{ createMvpComposition }, { createDemoAdapters }] = await Promise.all([
    load("src/composition/index.ts"),
    load("src/composition/demo.ts"),
  ]);
  const demoAdapters = createDemoAdapters();
  const composition = await createMvpComposition({
    config: demoConfig,
    demoAdapters,
    overrides: {
      selector: {
        async select() {
          return {
            selectedIds: ["not-returned-by-searchCatalog"],
            topPickReason: "허용되지 않은 이유",
            tokenUsage: 0,
          };
        },
      },
    },
  });

  try {
    const response = await composition.services.recommend({
      choice: { moods: ["밝은"] },
    });
    assert.equal(response.status, "completed");
    assert.equal(response.fallbackUsed, true);
    assert.ok(response.topPick, "룰 기반 1위 작품이 있어야 한다");
    const run = await composition.adapters.runs.get(response.runId);
    assert.equal(run.executionMode, "FALLBACK");
    assert.equal(run.fallbackReason, "MODEL_INVALID_OUTPUT");
    assert.ok(
      response.recommendations.every(
        (item) => item.content.id !== "not-returned-by-searchCatalog",
      ),
    );
  } finally {
    await composition.dispose();
  }
});

test("searchCatalog는 필수 조건을 통과한 canonical 후보만 Agent에 전달한다", async () => {
  const [
    { createMvpComposition },
    { createDemoAdapters },
    { DEMO_CATALOG },
  ] = await Promise.all([
    load("src/composition/index.ts"),
    load("src/composition/demo.ts"),
    load("src/demo/fixtures/catalog.ts"),
  ]);
  const adult = DEMO_CATALOG.find((item) => item.ageRating === "18");
  assert.ok(adult, "18세 fixture가 있어야 한다");
  let candidatesSeenByAgent = [];
  const demoAdapters = createDemoAdapters();
  const composition = await createMvpComposition({
    config: demoConfig,
    demoAdapters,
    overrides: {
      search: {
        async search(_invocation, candidates) {
          return {
            results: [
              { content: adult, semanticScore: 1 },
              ...candidates.map((content, index) => ({
                content,
                semanticScore: 0.9 - index * 0.001,
              })),
            ],
            continuation: {
              queryVector: {
                algorithm: "local-hash-cosine-v1",
                version: 1,
                dimensions: 64,
                values: Array(64).fill(0),
              },
              inputFingerprint: `sha256:${"b".repeat(64)}`,
            },
            modelCallCount: 0,
            tokenUsage: 0,
          };
        },
      },
      selector: {
        async select(candidates) {
          candidatesSeenByAgent = candidates;
          return {
            selectedIds: candidates
              .slice(0, 5)
              .map(({ content }) => content.id),
            tokenUsage: 0,
          };
        },
      },
    },
  });

  try {
    const response = await composition.services.recommend({
      choice: { moods: ["밝은"] },
    });
    assert.equal(response.status, "completed");
    assert.ok(candidatesSeenByAgent.length >= 5);
    assert.ok(
      candidatesSeenByAgent.every((item) => item.content.id !== adult.id),
      "필수 조건에서 제외된 후보가 Agent allowlist에 들어가면 안 된다",
    );
  } finally {
    await composition.dispose();
  }
});
