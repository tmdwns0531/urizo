import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  fsCache: false,
  moduleCache: false,
});
const { CuratorConversationService } = await jiti.import(
  fileURLToPath(
    new URL("../src/domains/curator/conversation.ts", import.meta.url),
  ),
);
const { DeterministicCuratorInterpreter } = await jiti.import(
  fileURLToPath(
    new URL(
      "../src/domains/curator/deterministic-interpreter.ts",
      import.meta.url,
    ),
  ),
);
const { OpenAiCuratorAdapter } = await jiti.import(
  fileURLToPath(
    new URL(
      "../src/adapters/curator/openai-curator-adapter.ts",
      import.meta.url,
    ),
  ),
);

function choice(overrides = {}) {
  return {
    selectedProviders: [],
    companions: ["ANY"],
    moods: ["따뜻한"],
    desiredGenres: [],
    companionAvoidGenres: [],
    requiredGenres: [],
    excludedGenres: [],
    mediaType: "ANY",
    naturalRuntimeMinutes: null,
    childAgeRatingLimit: null,
    originPreference: "ANY",
    ...overrides,
  };
}

function state(turn = 0, choiceOverrides = {}) {
  return {
    turn,
    resolvedTopics: ["MOOD"],
    preferenceSummary: "따뜻한 느낌",
    searchQuery: "마음이 편안해지는 따뜻한 작품",
    choice: choice(choiceOverrides),
  };
}

function request(turn = 0, choiceOverrides = {}) {
  return {
    pageContext: "HOME",
    message: "조금 더 정리해 줘",
    image: null,
    state: state(turn, choiceOverrides),
  };
}

function askOutput(choiceOverrides = {}) {
  return {
    action: "ASK",
    reply: "누구와 함께 볼 예정인가요?",
    questionTopic: "COMPANION",
    quickReplies: ["혼자", "연인과"],
    resolvedTopics: ["MOOD"],
    preferenceSummary: "따뜻한 느낌",
    searchQuery: "마음이 편안해지는 따뜻한 작품",
    choice: choice(choiceOverrides),
  };
}

function readyOutput(choiceOverrides = {}) {
  return {
    action: "READY",
    reply: "조건을 정리했어요.",
    questionTopic: null,
    quickReplies: [],
    resolvedTopics: ["MOOD"],
    preferenceSummary: "따뜻한 느낌",
    searchQuery: "마음이 편안해지는 따뜻한 작품",
    choice: choice(choiceOverrides),
  };
}

test("sixth-turn ASK is replaced by a deterministic READY handoff", async () => {
  let fallbackCalls = 0;
  const service = new CuratorConversationService(
    { async interpret() { return askOutput(); } },
    {
      async interpret() {
        fallbackCalls += 1;
        return readyOutput();
      },
    },
  );
  const response = await service.turn(request(5));
  assert.equal(response.action, "READY");
  assert.equal(response.state.turn, 6);
  assert.equal(response.fallbackUsed, true);
  assert.equal(fallbackCalls, 1);
  assert.ok(response.handoff);
});

test("production deterministic interpreter completes the sixth turn safely", async () => {
  const deterministic = new DeterministicCuratorInterpreter();
  const service = new CuratorConversationService(deterministic);
  const response = await service.turn(request(5));
  assert.equal(response.action, "READY");
  assert.equal(response.state.turn, 6);
  assert.ok(response.handoff);
});

test("invalid OpenAI JSON falls back through the production service path", async () => {
  const primary = new OpenAiCuratorAdapter({
    apiKey: "test-secret",
    model: "gpt-test",
    fetchImplementation: async () => ({
      ok: true,
      status: 200,
      async json() {
        return { output_text: "not-json" };
      },
    }),
  });
  const service = new CuratorConversationService(
    primary,
    new DeterministicCuratorInterpreter(),
  );
  const response = await service.turn(request());
  assert.equal(response.action, "ASK");
  assert.equal(response.questionTopic, "COMPANION");
  assert.equal(response.fallbackUsed, true);
});

test("a model cannot silently relax confirmed hard constraints", async () => {
  const confirmed = {
    selectedProviders: ["NETFLIX"],
    companions: ["WITH_CHILDREN"],
    naturalRuntimeMinutes: 60,
    childAgeRatingLimit: "7",
    requiredGenres: ["애니메이션"],
    excludedGenres: ["공포"],
    mediaType: "MOVIE",
    originPreference: "KR",
  };
  const hardRequest = request(3, confirmed);
  hardRequest.state.resolvedTopics = [
    "MOOD",
    "GENRE",
    "RUNTIME",
    "PROVIDER",
    "COMPANION",
    "MEDIA_TYPE",
    "ORIGIN",
    "CHILD_AGE",
  ];
  const service = new CuratorConversationService(
    { async interpret() { return readyOutput(); } },
    new DeterministicCuratorInterpreter(),
  );
  const response = await service.turn(hardRequest);
  assert.equal(response.action, "READY");
  assert.equal(response.fallbackUsed, true);
  assert.deepEqual(response.state.choice.selectedProviders, ["NETFLIX"]);
  assert.deepEqual(response.state.choice.companions, ["WITH_CHILDREN"]);
  assert.equal(response.state.choice.naturalRuntimeMinutes, 60);
  assert.equal(response.state.choice.childAgeRatingLimit, "7");
  assert.deepEqual(response.state.choice.requiredGenres, ["애니메이션"]);
  assert.deepEqual(response.state.choice.excludedGenres, ["공포"]);
  assert.equal(response.state.choice.mediaType, "MOVIE");
  assert.equal(response.state.choice.originPreference, "KR");
  assert.deepEqual(response.handoff.choice.selectedProviders, ["NETFLIX"]);
  assert.equal(response.handoff.choice.childAgeRatingLimit, "7");
});

test("explicit hard intent must match the model output instead of bypassing it", async () => {
  const childRequest = request(2, {
    companions: ["WITH_CHILDREN"],
    childAgeRatingLimit: "7",
  });
  childRequest.message = "아이와 계속 보되 공포는 빼고";
  childRequest.state.resolvedTopics = [
    "MOOD",
    "COMPANION",
    "RUNTIME",
    "CHILD_AGE",
  ];
  const service = new CuratorConversationService(
    { async interpret() { return readyOutput(); } },
    new DeterministicCuratorInterpreter(),
  );
  const response = await service.turn(childRequest);
  assert.equal(response.fallbackUsed, true);
  assert.deepEqual(response.state.choice.companions, ["WITH_CHILDREN"]);
  assert.equal(response.state.choice.childAgeRatingLimit, "7");
  assert.deepEqual(response.state.choice.excludedGenres, ["공포", "스릴러"]);
  assert.equal(response.handoff.choice.childAgeRatingLimit, "7");
});

test("unsafe child READY output is rejected before handoff and falls back", async () => {
  const childChoice = {
    companions: ["WITH_CHILDREN"],
    childAgeRatingLimit: null,
  };
  const service = new CuratorConversationService(
    { async interpret() { return readyOutput(childChoice); } },
    {
      async interpret() {
        return {
          ...askOutput(childChoice),
          reply: "아이의 관람등급 상한을 알려주세요.",
          questionTopic: "CHILD_AGE",
          quickReplies: ["전체 관람가", "7세 이하", "12세 이하", "15세 이하"],
        };
      },
    },
  );
  const response = await service.turn(request(0, childChoice));
  assert.equal(response.action, "ASK");
  assert.equal(response.questionTopic, "CHILD_AGE");
  assert.equal(response.fallbackUsed, true);
  assert.equal(response.handoff, null);
});

test("a confirmed child rating is preserved in the validated handoff", async () => {
  const service = new CuratorConversationService(
    new DeterministicCuratorInterpreter(),
  );
  const childRequest = request(2, {
    companions: ["WITH_CHILDREN"],
    childAgeRatingLimit: null,
  });
  childRequest.message = "12세 이하로 볼게";
  childRequest.state.resolvedTopics = ["MOOD", "COMPANION", "RUNTIME"];
  const response = await service.turn(childRequest);
  assert.equal(response.action, "READY");
  assert.equal(response.state.choice.childAgeRatingLimit, "12");
  assert.equal(response.handoff.choice.childAgeRatingLimit, "12");
});

test("the final turn defaults an unanswered child rating to ALL", async () => {
  const service = new CuratorConversationService(
    new DeterministicCuratorInterpreter(),
  );
  const childRequest = request(5, {
    companions: ["WITH_CHILDREN"],
    childAgeRatingLimit: null,
  });
  childRequest.state.resolvedTopics = ["MOOD", "COMPANION", "RUNTIME"];
  const response = await service.turn(childRequest);
  assert.equal(response.action, "READY");
  assert.deepEqual(response.state.choice.companions, ["WITH_CHILDREN"]);
  assert.equal(response.state.choice.childAgeRatingLimit, "ALL");
  assert.equal(response.handoff.choice.childAgeRatingLimit, "ALL");
});

test("runtime-neutral wording does not relax an existing media type", async () => {
  const service = new CuratorConversationService(
    new DeterministicCuratorInterpreter(),
  );
  const movieRequest = request(2, {
    mediaType: "MOVIE",
    naturalRuntimeMinutes: 60,
  });
  movieRequest.message = "시간은 상관없어";
  movieRequest.state.resolvedTopics = ["MOOD", "COMPANION", "RUNTIME"];
  const response = await service.turn(movieRequest);
  assert.equal(response.action, "READY");
  assert.equal(response.state.choice.naturalRuntimeMinutes, null);
  assert.equal(response.state.choice.mediaType, "MOVIE");
  assert.equal(response.handoff.choice.mediaType, "MOVIE");
});

test("curator output scrubs common direct identifiers before state and handoff", async () => {
  const unsafe = readyOutput();
  unsafe.reply = "test@example.com 또는 010-1234-5678로 알려주세요";
  unsafe.preferenceSummary = "https://example.com test@example.com 따뜻한 작품";
  unsafe.searchQuery = "010-1234-5678 따뜻한 작품";
  const service = new CuratorConversationService({
    async interpret() {
      return unsafe;
    },
  });
  const response = await service.turn(request());
  const serialized = JSON.stringify(response);
  assert.equal(serialized.includes("test@example.com"), false);
  assert.equal(serialized.includes("010-1234-5678"), false);
  assert.equal(serialized.includes("https://example.com"), false);
  assert.equal(
    response.handoff.choice.naturalLanguage,
    response.state.searchQuery,
  );
});
