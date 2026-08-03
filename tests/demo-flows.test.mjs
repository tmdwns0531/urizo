import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("anonymous-demo-flows", `${process.pid}-${Date.now()}`);
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

async function request(path, options = {}) {
  const { method = "GET", json, headers = {} } = options;
  const requestHeaders = new Headers(headers);
  if (json !== undefined) requestHeaders.set("content-type", "application/json");
  requestHeaders.set(
    "accept",
    requestHeaders.get("accept") ?? "application/json",
  );

  return worker.fetch(
    new Request(new URL(path, "http://localhost"), {
      method,
      headers: requestHeaders,
      body: json === undefined ? undefined : JSON.stringify(json),
    }),
    env,
    executionContext,
  );
}

async function jsonRequest(path, options = {}) {
  const response = await request(path, options);
  const text = await response.text();
  assert.match(
    response.headers.get("content-type") ?? "",
    /^application\/json\b/i,
    `${options.method ?? "GET"} ${path} did not return JSON: ${text.slice(0, 300)}`,
  );
  return { response, body: JSON.parse(text) };
}

function assertStatus(result, expected, label) {
  assert.equal(
    result.response.status,
    expected,
    `${label}: ${JSON.stringify(result.body)}`,
  );
}

async function resetDemo() {
  const result = await jsonRequest("/api/demo/reset", { method: "POST" });
  assertStatus(result, 200, "reset Demo state");
  assert.deepEqual(result.body, { ok: true });
}

function broadRequest(scenario = "normal", choiceOverrides = {}) {
  return {
    ...(scenario === "normal" ? {} : { scenario }),
    choice: {
      selectedProviders: [],
      companions: ["ANY"],
      moods: ["따뜻한"],
      desiredGenres: [],
      companionAvoidGenres: [],
      maxRuntimeMinutes: scenario === "approval" ? 30 : null,
      originPreference: "ANY",
      naturalLanguage: "",
      ...choiceOverrides,
    },
  };
}

async function createRecommendation(payload, label = "recommendation") {
  const result = await jsonRequest("/api/recommendations", {
    method: "POST",
    json: payload,
  });
  assertStatus(result, 201, `create ${label}`);
  assert.equal(typeof result.body.runId, "string");
  assert.match(result.body.runId, /^run_/);
  return result.body;
}

function recommendationIds(response) {
  return response.recommendations.map((item) => item.content.id);
}

function assertUniqueRecommendations(response) {
  const ids = recommendationIds(response);
  assert.equal(new Set(ids).size, ids.length, "content IDs must be unique");
}

test("OTT Damoa anonymous Demo integration", async (t) => {
  await t.test("renders the product homepage", async () => {
    const response = await request("/", { headers: { accept: "text/html" } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    const html = await response.text();
    assert.match(html, /OTT 다모아/);
    assert.match(html, /오늘 볼 작품/);
    assert.match(html, /지금 상황 반영/);
    assert.match(html, /<nav\b/i);
    assert.match(html, /<main\b/i);
    assert.match(html, /<footer\b/i);
    assert.match(html, /href="\/choice"/i);
    assert.match(html, /조건 골라 추천받기/);
    assert.match(html, /문장으로 추천받기/);
    assert.match(html, /href="\/prompt"/i);
    assert.doesNotMatch(
      html,
      /href="\/(?:login|signup|profile|my|saved|watched|community)(?:[/?#"])/i,
    );
    assert.doesNotMatch(html, /Your site is taking shape|Starter Project/);
  });

  await t.test("renders the natural-language recommendation entry", async () => {
    const response = await request("/prompt", {
      headers: { accept: "text/html" },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    const html = await response.text();
    assert.match(html, /한마디 추천/);
    assert.match(html, /지금 보고 싶은 작품/);
    assert.match(html, /natural-request/);
    assert.doesNotMatch(html, /로그인|회원가입|SIGN IN/i);
  });

  await t.test("reports the complete credential-free Demo preset", async () => {
    const result = await jsonRequest("/api/health");
    assertStatus(result, 200, "health");
    assert.equal(result.body.status, "ok");
    assert.equal(result.body.mode, "demo");
    assert.equal(result.body.fullyDemo, true);
    assert.equal(result.body.fullyLive, false);
    assert.deepEqual(result.body.adapters, {
      catalog: "fixture",
      search: "local",
      selector: "deterministic",
      runStore: "memory",
      traceStore: "memory",
    });
    assert.deepEqual(result.body.adapterStatus, {
      catalog: "ok",
      search: "ok",
      selector: "ok",
      runStore: "ok",
      traceStore: "ok",
    });
    assert.doesNotMatch(JSON.stringify(result.body), /api[_-]?key|database_url/i);
  });

  await t.test("returns and persists five anonymous recommendations", async () => {
    await resetDemo();
    const created = await createRecommendation(broadRequest(), "normal run");
    assert.equal(created.status, "completed");
    assert.equal(created.fallbackUsed, false);
    assert.equal(created.recommendations.length, 5);
    assertUniqueRecommendations(created);
    assert.deepEqual(created.topPick, created.recommendations[0]);
    assert.ok(created.trace.some((event) => event.action === "filter"));
    assert.ok(created.trace.some((event) => event.action === "complete"));

    const fetched = await jsonRequest(
      `/api/recommendations/${encodeURIComponent(created.runId)}`,
    );
    assertStatus(fetched, 200, "fetch recommendation run");
    assert.deepEqual(recommendationIds(fetched.body), recommendationIds(created));
  });

  await t.test("accepts the exact payload produced by the Choice form", async () => {
    await resetDemo();
    const created = await createRecommendation(
      {
        choice: {
          selectedProviders: ["NETFLIX", "TVING"],
          companions: ["ALONE"],
          moods: ["밝은"],
          maxRuntimeMinutes: 120,
          originPreference: "ANY",
          desiredGenres: [],
          explicitlyRequestedGenres: [],
          companionAvoidGenres: [],
        },
      },
      "Choice form run",
    );

    const fetched = await jsonRequest(
      `/api/recommendations/${encodeURIComponent(created.runId)}`,
    );
    assertStatus(fetched, 200, "fetch Choice form run");
    assert.equal(fetched.body.runId, created.runId);
  });

  await t.test("rejects unknown fields and oversized natural language", async () => {
    const unknown = await jsonRequest("/api/recommendations", {
      method: "POST",
      json: { userId: "forbidden-identity", choice: {} },
    });
    assertStatus(unknown, 400, "unknown request field");
    assert.equal(unknown.body.code, "BAD_REQUEST");

    const oversized = await jsonRequest("/api/recommendations", {
      method: "POST",
      json: broadRequest("normal", { naturalLanguage: "가".repeat(141) }),
    });
    assertStatus(oversized, 400, "oversized natural language");
    assert.equal(oversized.body.code, "BAD_REQUEST");

    const oversizedBody = await jsonRequest("/api/recommendations", {
      method: "POST",
      json: broadRequest("normal", { naturalLanguage: "가".repeat(6_000) }),
    });
    assertStatus(oversizedBody, 400, "oversized request body");
    assert.equal(oversizedBody.body.code, "BAD_REQUEST");
    assert.match(oversizedBody.body.error, /바이트/);
  });

  await t.test("rejects a recommendation with no meaningful condition", async () => {
    const neutral = await jsonRequest("/api/recommendations", {
      method: "POST",
      json: { choice: {} },
    });
    assertStatus(neutral, 400, "neutral recommendation request");
    assert.equal(neutral.body.code, "BAD_REQUEST");
    assert.match(neutral.body.error, /추천 조건을 하나 이상/);
  });

  await t.test("never returns the natural-language source in Run or Trace", async () => {
    await resetDemo();
    const canary = "PRIVATE-NATURAL-LANGUAGE-CANARY-7429";
    const created = await createRecommendation(
      broadRequest("normal", { naturalLanguage: canary }),
      "privacy canary run",
    );
    assert.doesNotMatch(JSON.stringify(created), new RegExp(canary));

    const fetched = await jsonRequest(
      `/api/recommendations/${encodeURIComponent(created.runId)}`,
    );
    assert.doesNotMatch(JSON.stringify(fetched.body), new RegExp(canary));
  });

  await t.test("continues one Agent clarification turn through the approval endpoint", async () => {
    await resetDemo();
    const source = "가족과 따뜻한 작품을 보고 싶어";
    const awaiting = await createRecommendation(
      { choice: { naturalLanguage: source } },
      "Agent clarification run",
    );
    assert.equal(awaiting.status, "awaiting_approval");
    assert.equal(awaiting.proposal.kind, "FAMILY_COMPOSITION");
    assert.equal(awaiting.partialRecommendations.length, 0);
    assert.doesNotMatch(JSON.stringify(awaiting), new RegExp(source));

    const answered = await jsonRequest(
      `/api/recommendations/${encodeURIComponent(awaiting.runId)}/approval`,
      {
        method: "POST",
        json: { answer: "ADULTS_ONLY", naturalLanguage: source },
      },
    );
    assertStatus(answered, 200, "answer Agent clarification");
    assert.equal(answered.body.status, "completed");
    assert.equal(answered.body.recommendations.length, 5);
    assert.doesNotMatch(JSON.stringify(answered.body), new RegExp(source));
  });

  await t.test("requires approval before a 30 to 45 minute relaxation", async () => {
    await resetDemo();
    const awaiting = await createRecommendation(
      broadRequest("approval"),
      "approval run",
    );
    assert.equal(awaiting.status, "awaiting_approval");
    assert.equal(awaiting.proposal.currentMaxMinutes, 30);
    assert.equal(awaiting.proposal.proposedMaxMinutes, 45);
    assert.ok(awaiting.partialRecommendations.length < 5);
    assert.ok(
      awaiting.partialRecommendations.every(
        (item) => item.content.runtimeMinutes <= 30,
      ),
    );

    const approved = await jsonRequest(
      `/api/recommendations/${encodeURIComponent(awaiting.runId)}/approval`,
      { method: "POST", json: { decision: "approve" } },
    );
    assertStatus(approved, 200, "approve runtime relaxation");
    assert.equal(approved.body.status, "completed");
    assert.equal(approved.body.recommendations.length, 5);
    assert.ok(
      approved.body.recommendations.every(
        (item) => item.content.runtimeMinutes <= 45,
      ),
    );
    assert.ok(
      approved.body.trace.some(
        (event) => event.action === "approval_decision",
      ),
    );
  });

  await t.test("completes with the partial result after rejection", async () => {
    await resetDemo();
    const awaiting = await createRecommendation(
      broadRequest("approval"),
      "approval rejection run",
    );
    const partialIds = awaiting.partialRecommendations.map(
      (item) => item.content.id,
    );
    const rejected = await jsonRequest(
      `/api/recommendations/${encodeURIComponent(awaiting.runId)}/approval`,
      { method: "POST", json: { decision: "reject" } },
    );
    assertStatus(rejected, 200, "reject runtime relaxation");
    assert.equal(rejected.body.status, "completed");
    assert.deepEqual(recommendationIds(rejected.body), partialIds);
    assert.ok(
      rejected.body.recommendations.every(
        (item) => item.content.runtimeMinutes <= 30,
      ),
    );
  });

  await t.test("final policy removes unsafe ratings", async () => {
    await resetDemo();
    const created = await createRecommendation(
      broadRequest("policy_block"),
      "policy block run",
    );
    assert.equal(created.status, "completed");
    assert.ok(created.policyBlockedCount > 0);
    assert.ok(created.trace.some((event) => event.action === "policy_block"));
    assert.ok(
      created.recommendations.every(
        (item) =>
          item.content.ageRating !== "18" &&
          item.content.ageRating !== "UNKNOWN",
      ),
    );
    assertUniqueRecommendations(created);
  });

  await t.test("uses a deterministic safe fallback when the budget is exceeded", async () => {
    const payload = broadRequest("budget_fallback");
    await resetDemo();
    const first = await createRecommendation(payload, "fallback run");
    assert.equal(first.status, "completed");
    assert.equal(first.fallbackUsed, true);
    assert.equal(first.recommendations.length, 5);
    assert.ok(first.trace.some((event) => event.action === "fallback"));

    await resetDemo();
    const second = await createRecommendation(payload, "second fallback run");
    assert.deepEqual(recommendationIds(second), recommendationIds(first));
    assert.deepEqual(
      second.recommendations.map((item) => item.matchPercent),
      first.recommendations.map((item) => item.matchPercent),
    );
  });

  await t.test("replaces exactly one item inside the original policy", async () => {
    await resetDemo();
    const created = await createRecommendation(broadRequest(), "replacement run");
    const originalIds = recommendationIds(created);
    const replacedId = originalIds[0];
    const replacement = await jsonRequest(
      `/api/recommendations/${encodeURIComponent(created.runId)}/replacement`,
      { method: "POST", json: { contentId: replacedId } },
    );
    assertStatus(replacement, 200, "replace recommendation");
    assert.equal(replacement.body.status, "completed");
    assert.equal(replacement.body.recommendations.length, originalIds.length);
    assertUniqueRecommendations(replacement.body);
    const replacementIds = recommendationIds(replacement.body);
    const changedIndexes = replacementIds
      .map((id, index) => (id === originalIds[index] ? -1 : index))
      .filter((index) => index >= 0);
    assert.deepEqual(changedIndexes, [0]);
    assert.ok(!replacementIds.includes(replacedId));
    assert.equal(replacement.body.recommendations[0].replacementOf, replacedId);
    assert.ok(
      replacement.body.trace.some((event) => event.action === "replacement"),
    );
  });

  await t.test("returns 404 for unknown runs and reset removes Demo runs", async () => {
    await resetDemo();
    const missing = await jsonRequest("/api/recommendations/run-does-not-exist");
    assertStatus(missing, 404, "unknown run");

    const created = await createRecommendation(broadRequest(), "reset run");
    await resetDemo();
    const removed = await jsonRequest(
      `/api/recommendations/${encodeURIComponent(created.runId)}`,
    );
    assertStatus(removed, 404, "run after Demo reset");
  });
});
