import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  fsCache: false,
  moduleCache: false,
});

const {
  OpenAiCuratorAdapter,
  CuratorModelRequestError,
  CuratorModelTimeoutError,
} = await jiti.import(
  fileURLToPath(
    new URL(
      "../src/adapters/curator/openai-curator-adapter.ts",
      import.meta.url,
    ),
  ),
);

function request(image = null) {
  return {
    pageContext: "HOME",
    message: "따뜻한 느낌을 원해",
    image,
    state: {
      turn: 0,
      resolvedTopics: [],
      preferenceSummary: "",
      searchQuery: "",
      choice: {
        selectedProviders: [],
        companions: ["ANY"],
        moods: [],
        desiredGenres: [],
        companionAvoidGenres: [],
        requiredGenres: [],
        excludedGenres: [],
        mediaType: "ANY",
        naturalRuntimeMinutes: null,
        childAgeRatingLimit: null,
        originPreference: "ANY",
      },
    },
  };
}

const modelOutput = {
  action: "ASK",
  reply: "누구와 함께 볼 예정인가요?",
  questionTopic: "COMPANION",
  quickReplies: ["혼자", "연인과", "친구들과", "가족과"],
  resolvedTopics: ["MOOD"],
  preferenceSummary: "따뜻한 느낌",
  searchQuery: "마음이 편안해지는 따뜻한 작품",
  choice: {
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
  },
};

test("OpenAI curator uses stateless Responses vision and strict structured output", async () => {
  let captured;
  const adapter = new OpenAiCuratorAdapter({
    apiKey: "test-secret-key",
    model: "gpt-5.6-terra",
    fetchImplementation: async (_url, init) => {
      captured = init;
      return {
        ok: true,
        status: 200,
        async json() {
          return { output_text: JSON.stringify(modelOutput) };
        },
      };
    },
  });
  const image = {
    mediaType: "image/jpeg",
    base64: "/9j/AAAAAAAAAAAA",
  };
  const output = await adapter.interpret(request(image));
  assert.deepEqual(output, modelOutput);

  const body = JSON.parse(captured.body);
  assert.equal(body.store, false);
  assert.deepEqual(body.reasoning, { effort: "none" });
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.text.format.strict, true);
  assert.equal(body.text.format.schema.additionalProperties, false);
  assert.equal(
    JSON.stringify(body.text.format.schema).includes("uniqueItems"),
    false,
  );
  assert.deepEqual(body.text.format.schema.required, [
    "action",
    "reply",
    "questionTopic",
    "quickReplies",
    "resolvedTopics",
    "preferenceSummary",
    "searchQuery",
    "choice",
  ]);
  assert.equal(
    body.text.format.schema.properties.choice.additionalProperties,
    false,
  );
  const imageContent = body.input[1].content.find(
    (content) => content.type === "input_image",
  );
  assert.equal(imageContent.detail, "low");
  assert.equal(imageContent.image_url, `data:image/jpeg;base64,${image.base64}`);
  const systemPrompt = body.input[0].content[0].text;
  assert.match(
    systemPrompt,
    /색감·분위기·배경·(?:시각 )?장르 단서만 사용한다/,
  );
  assert.match(
    systemPrompt,
    /사람의 신원.*민감하거나 개인적인 속성을 추론하지 않는다/s,
  );
  assert.equal(JSON.stringify(body).includes("test-secret-key"), false);
});

test("OpenAI curator hides provider details and enforces its timeout", async () => {
  const failed = new OpenAiCuratorAdapter({
    apiKey: "secret-that-must-not-leak",
    model: "gpt-5.6-terra",
    fetchImplementation: async () => ({
      ok: false,
      status: 500,
      async json() {
        return { error: "raw-provider-secret" };
      },
    }),
  });
  await assert.rejects(failed.interpret(request()), (error) => {
    assert.ok(error instanceof CuratorModelRequestError);
    assert.equal(error.message.includes("raw-provider-secret"), false);
    assert.equal(error.message.includes("secret-that-must-not-leak"), false);
    return true;
  });

  const timeout = new OpenAiCuratorAdapter({
    apiKey: "test-key",
    model: "gpt-5.6-terra",
    timeoutMs: 5,
    fetchImplementation: async () => new Promise(() => {}),
  });
  await assert.rejects(
    timeout.interpret(request()),
    (error) => error instanceof CuratorModelTimeoutError,
  );
});
