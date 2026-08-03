import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL(
    "../src/components/completed-recommendation-result.tsx",
    import.meta.url,
  ),
  "utf8",
);

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("replacement-interest", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const env = {
  ASSETS: {
    fetch: async () => new Response("Not found", { status: 404 }),
  },
  IMAGES: {
    input() {
      return {
        transform() {
          return {
            async output() {
              return {
                response() {
                  return new Response("Image transform is not used in tests.", {
                    status: 501,
                  });
                },
              };
            },
          };
        },
      };
    },
  },
};

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

async function jsonRequest(path, options = {}) {
  const headers = new Headers({ accept: "application/json" });
  if (options.json !== undefined) {
    headers.set("content-type", "application/json");
  }
  const response = await worker.fetch(
    new Request(new URL(path, "http://localhost"), {
      method: options.method ?? "GET",
      headers,
      body:
        options.json === undefined ? undefined : JSON.stringify(options.json),
    }),
    env,
    executionContext,
  );
  return { response, body: await response.json() };
}

const recommendationIds = (response) =>
  response.recommendations.map((item) => item.content.id);

test("replacement feedback states render through a visible notice", () => {
  const feedbackDefinitions = source.slice(
    source.indexOf("export const REPLACEMENT_FEEDBACK"),
    source.indexOf("class ReplacementRequestError"),
  );
  const noticeBody = source.slice(
    source.indexOf("export function ReplacementFeedbackNotice"),
    source.indexOf("function rememberNotInterested"),
  );

  for (const status of ["pending", "success", "exhausted", "error"]) {
    assert.match(feedbackDefinitions, new RegExp(`status: "${status}"`));
  }
  assert.match(
    noticeBody,
    /className="result-notice result-notice--neutral"/,
  );
  assert.match(
    noticeBody,
    /data-replacement-state=\{feedback\.status\}/,
  );
  assert.match(noticeBody, /<strong>\{feedback\.title\}<\/strong>/);
  assert.match(noticeBody, /<p>\{feedback\.description\}<\/p>/);
  assert.doesNotMatch(noticeBody, /sr-only/);
});

test("five recommendation IDs keep a five-card completed layout", () => {
  const completedBody = source.slice(
    source.indexOf("export function CompletedRecommendationResult"),
  );
  const ids = Array.from({ length: 5 }, (_, index) => `content-${index + 1}`);
  const topPickId = ids[0];
  const alternativeIds = ids.filter((id) => id !== topPickId);

  assert.equal(1 + alternativeIds.length, ids.length);
  assert.match(
    completedBody,
    /조건에 맞는 \{response\.recommendations\.length\}편을 찾았어요/,
  );
  assert.match(
    completedBody,
    /item=\{response\.topPick\}[\s\S]*?rank=\{1\}[\s\S]*?hero/,
  );
  assert.match(
    completedBody,
    /alternatives\.map\(\(item, index\) => \([\s\S]*?<ContentCard[\s\S]*?key=\{item\.content\.id\}/,
  );
});

test("replacement flow keeps the click lock and maps visible outcomes", () => {
  const replacementBody = source.slice(
    source.indexOf("  async function replace("),
    source.indexOf("  async function replaceAll("),
  );

  assert.match(replacementBody, /if \(replacementLock\.current\) return;/);
  assert.match(replacementBody, /replacementLock\.current = true;/);
  assert.match(
    replacementBody,
    /showFeedback\(REPLACEMENT_FEEDBACK\.pending\)/,
  );
  assert.match(
    source,
    /request\.status === 400 \? "exhausted" : "error"/,
  );
  assert.match(
    replacementBody,
    /showFeedback\(REPLACEMENT_FEEDBACK\.success\)/,
  );
  assert.match(
    replacementBody,
    /finally \{[\s\S]*replacementLock\.current = false;[\s\S]*setReplacingId\(null\)/,
  );
});

test("same-condition refresh reuses safe continuation replacements", () => {
  const replacementBody = source.slice(
    source.indexOf("  async function replaceAll("),
    source.indexOf("  const provider ="),
  );

  assert.match(replacementBody, /for \(const item of response\.recommendations\)/);
  assert.match(
    replacementBody,
    /requestReplacement\(current\.runId, item\.content\.id\)/,
  );
  assert.match(replacementBody, /onResponseChange\(current\)/);
  assert.doesNotMatch(replacementBody, /Math\.random|sort\(\(\) =>/);
});

test("Demo replacement preserves five cards and the last snapshot on exhaustion", async () => {
  const reset = await jsonRequest("/api/demo/reset", { method: "POST" });
  assert.equal(reset.response.status, 200);

  const requestBody = {
    choice: {
      selectedProviders: [],
      companions: ["ANY"],
      moods: ["따뜻한"],
      desiredGenres: [],
      companionAvoidGenres: [],
      maxRuntimeMinutes: null,
      originPreference: "ANY",
      naturalLanguage: "",
    },
  };
  const created = await jsonRequest("/api/recommendations", {
    method: "POST",
    json: requestBody,
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.status, "completed");
  assert.equal(created.body.recommendations.length, 5);

  const runId = created.body.runId;
  let currentIds = recommendationIds(created.body);
  let successCount = 0;
  let exhausted = false;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const targetIndex = 1;
    const targetId = currentIds[targetIndex];
    const replacement = await jsonRequest(
      `/api/recommendations/${encodeURIComponent(runId)}/replacement`,
      { method: "POST", json: { contentId: targetId } },
    );

    if (replacement.response.status === 400) {
      exhausted = true;
      assert.equal(replacement.body.code, "BAD_REQUEST");
      const fetched = await jsonRequest(
        `/api/recommendations/${encodeURIComponent(runId)}`,
      );
      assert.equal(fetched.response.status, 200);
      assert.deepEqual(recommendationIds(fetched.body), currentIds);
      break;
    }

    assert.equal(replacement.response.status, 200);
    const nextIds = recommendationIds(replacement.body);
    assert.equal(nextIds.length, currentIds.length);
    assert.equal(new Set(nextIds).size, nextIds.length);
    assert.equal(replacement.body.topPick.content.id, nextIds[0]);
    const changedIndexes = nextIds
      .map((id, index) => (id === currentIds[index] ? -1 : index))
      .filter((index) => index >= 0);
    assert.deepEqual(changedIndexes, [targetIndex]);
    currentIds = nextIds;
    successCount += 1;
  }

  assert.ok(successCount > 0);
  assert.equal(exhausted, true, "replacement fixture must reach exhaustion");
});
