import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("demo-flows", `${process.pid}-${Date.now()}`);
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
  if (json !== undefined) {
    requestHeaders.set("content-type", "application/json");
  }
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

  let body;
  try {
    body = JSON.parse(text);
  } catch (error) {
    assert.fail(
      `${options.method ?? "GET"} ${path} returned invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }\n${text.slice(0, 300)}`,
    );
  }
  return { response, body };
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

function broadRequest(scenario = "normal", extra = {}) {
  return {
    scenario,
    choice: {
      companions: ["ANY"],
      moods: ["따뜻한"],
      desiredGenres: [],
      companionAvoidGenres: [],
      maxRuntimeMinutes: null,
      originPreference: "ANY",
      naturalLanguage: "",
    },
    ...extra,
  };
}

async function createRecommendation(payload) {
  const result = await jsonRequest("/api/recommendations", {
    method: "POST",
    json: payload,
  });
  assertStatus(result, 201, `create ${payload.scenario} recommendation`);
  assert.equal(typeof result.body.runId, "string");
  assert.ok(result.body.runId.length > 0);
  return result.body;
}

function contentIds(response) {
  return response.recommendations.map((item) => item.content.id);
}

function assertUniqueContent(response) {
  const ids = contentIds(response);
  assert.equal(new Set(ids).size, ids.length, "content IDs must be unique");
}

test("OTT 다모아 Demo integration flows", async (t) => {
  await t.test("server-renders the OTT 다모아 homepage", async () => {
    const response = await request("/", {
      headers: { accept: "text/html" },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

    const html = await response.text();
    assert.match(html, /OTT 다모아/);
    assert.match(html, /오늘 볼 작품/);
    assert.match(html, /1분 안에 결정해요/);
    assert.match(html, /조건을 몰래 바꾸지/);
    assert.doesNotMatch(html, /Your site is taking shape|Starter Project/);
  });

  await t.test("health reports every Demo adapter", async () => {
    const result = await jsonRequest("/api/health");
    assertStatus(result, 200, "health");
    assert.equal(result.body.status, "ok");
    assert.equal(result.body.mode, "demo");
    assert.equal(result.body.fullyDemo, true);
    assert.deepEqual(result.body.adapters, {
      auth: "demo",
      catalog: "fixture",
      search: "local",
      selector: "deterministic",
      runStore: "memory",
      traceStore: "memory",
      engagementStore: "memory",
    });
  });

  await t.test("normal scenario returns five unique results", async () => {
    await resetDemo();
    const response = await createRecommendation(broadRequest());

    assert.equal(response.status, "completed");
    assert.equal(response.fallbackUsed, false);
    assert.equal(response.recommendations.length, 5);
    assertUniqueContent(response);
    assert.equal(
      response.topPick?.content.id,
      response.recommendations[0].content.id,
    );
    assert.ok(response.trace.some((event) => event.action === "filter"));
    assert.ok(response.trace.some((event) => event.action === "complete"));

    const fetched = await jsonRequest(
      `/api/recommendations/${encodeURIComponent(response.runId)}`,
    );
    assertStatus(fetched, 200, "fetch normal recommendation");
    assert.deepEqual(contentIds(fetched.body), contentIds(response));
  });

  await t.test("public trace never exposes the natural-language original", async () => {
    await resetDemo();
    const sensitiveQuery = "PRIVATE-CANARY-7429 비 오는 날 혼자 볼 작품";
    const payload = broadRequest();
    payload.choice.naturalLanguage = sensitiveQuery;
    const response = await createRecommendation(payload);

    assert.equal(response.status, "completed");
    assert.ok(
      !JSON.stringify(response.trace).includes(sensitiveQuery),
      "public trace must not contain the user's natural-language original",
    );
    const searchTrace = response.trace.find(
      (event) => event.action === "vector_search",
    );
    assert.match(searchTrace?.description ?? "", /원문 저장 없이/);
  });

  await t.test(
    "approval scenario asks first, then applies only the approved 45-minute limit",
    async () => {
      await resetDemo();
      const awaiting = await createRecommendation(
        broadRequest("approval"),
      );

      assert.equal(awaiting.status, "awaiting_approval");
      assert.equal(awaiting.proposal.kind, "RUNTIME_RELAXATION");
      assert.equal(awaiting.proposal.currentMaxMinutes, 30);
      assert.equal(awaiting.proposal.proposedMaxMinutes, 45);
      assert.equal(
        awaiting.proposal.currentCandidateCount,
        awaiting.partialRecommendations.length,
      );
      assert.ok(awaiting.partialRecommendations.length < 5);
      assert.ok(
        awaiting.partialRecommendations.every(
          (item) => item.content.runtimeMinutes <= 30,
        ),
      );
      assert.ok(
        awaiting.trace.some((event) => event.action === "approval_request"),
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
          (event) =>
            event.action === "approval_decision" &&
            event.metrics?.["승인"] === true,
        ),
      );
    },
  );

  await t.test(
    "approval rejection preserves and completes the partial result",
    async () => {
      await resetDemo();
      const awaiting = await createRecommendation(
        broadRequest("approval"),
      );
      assert.equal(awaiting.status, "awaiting_approval");
      const partialIds = awaiting.partialRecommendations.map(
        (item) => item.content.id,
      );

      const rejected = await jsonRequest(
        `/api/recommendations/${encodeURIComponent(awaiting.runId)}/approval`,
        { method: "POST", json: { decision: "reject" } },
      );
      assertStatus(rejected, 200, "reject runtime relaxation");
      assert.equal(rejected.body.status, "completed");
      assert.deepEqual(contentIds(rejected.body), partialIds);
      assert.ok(
        rejected.body.recommendations.every(
          (item) => item.content.runtimeMinutes <= 30,
        ),
      );
      assert.match(rejected.body.notice, /30분 조건/);
      assert.ok(
        rejected.body.trace.some(
          (event) =>
            event.action === "approval_decision" &&
            event.metrics?.["승인"] === false,
        ),
      );
    },
  );

  await t.test(
    "policy block removes adult and unknown ratings and exposes the block trace",
    async () => {
      await resetDemo();
      const response = await createRecommendation(
        broadRequest("policy_block", { userId: "demo-minor" }),
      );

      assert.equal(response.status, "completed");
      assert.ok(response.policyBlockedCount > 0);
      assert.ok(
        response.trace.some((event) => event.action === "policy_block"),
      );
      assert.ok(
        response.recommendations.every(
          (item) =>
            item.content.ageRating !== "18" &&
            item.content.ageRating !== "UNKNOWN",
        ),
      );
      assertUniqueContent(response);
    },
  );

  await t.test(
    "policy scenario keeps authenticated ownership and engagement together",
    async () => {
      await resetDemo();
      const response = await createRecommendation(
        broadRequest("policy_block", {
          userId: "client-supplied-user-must-be-ignored",
        }),
      );
      assert.equal(response.status, "completed");

      const visibleRuns = await jsonRequest(
        "/api/recommendations?userId=demo-minor",
      );
      assertStatus(visibleRuns, 200, "list authenticated user's runs");
      assert.ok(
        visibleRuns.body.runs.some((run) => run.runId === response.runId),
        "the policy scenario run must remain owned by the authenticated user",
      );

      const contentId = response.recommendations[0].content.id;
      const engagement = await jsonRequest("/api/engagement", {
        method: "POST",
        json: {
          userId: "demo-minor",
          runId: response.runId,
          contentId,
          type: "BOOKMARK",
        },
      });
      assertStatus(engagement, 201, "record policy scenario bookmark");
      assert.equal(engagement.body.userId, "demo-adult");
      assert.equal(engagement.body.runId, response.runId);

      const forged = await jsonRequest("/api/engagement", {
        method: "POST",
        json: {
          runId: response.runId,
          contentId: "deadpool",
          type: "BOOKMARK",
        },
      });
      assertStatus(forged, 404, "reject content outside the run");

      const profile = await jsonRequest("/api/users/profile");
      assertStatus(profile, 200, "read authenticated profile");
      assert.equal(profile.body.id, "demo-adult");
      assert.ok(profile.body.bookmarkedContentIds.includes(contentId));
      assert.ok(!profile.body.bookmarkedContentIds.includes("deadpool"));
    },
  );

  await t.test("missing runs are consistently hidden as 404", async () => {
    await resetDemo();
    const runId = "run-does-not-exist";
    const fetched = await jsonRequest(
      `/api/recommendations/${encodeURIComponent(runId)}`,
    );
    assertStatus(fetched, 404, "get missing run");

    const approval = await jsonRequest(
      `/api/recommendations/${encodeURIComponent(runId)}/approval`,
      { method: "POST", json: { decision: "approve" } },
    );
    assertStatus(approval, 404, "approve missing run");

    const replacement = await jsonRequest(
      `/api/recommendations/${encodeURIComponent(runId)}/replacement`,
      { method: "POST", json: { contentId: "little-forest" } },
    );
    assertStatus(replacement, 404, "replace missing run");
  });

  await t.test(
    "budget fallback is traced and deterministic for identical input",
    async () => {
      const payload = broadRequest("budget_fallback");

      await resetDemo();
      const first = await createRecommendation(payload);
      assert.equal(first.status, "completed");
      assert.equal(first.fallbackUsed, true);
      assert.equal(first.recommendations.length, 5);
      assert.ok(first.trace.some((event) => event.action === "fallback"));

      await resetDemo();
      const second = await createRecommendation(payload);
      assert.equal(second.status, "completed");
      assert.equal(second.fallbackUsed, true);
      assert.deepEqual(contentIds(second), contentIds(first));
      assert.deepEqual(
        second.recommendations.map((item) => item.matchPercent),
        first.recommendations.map((item) => item.matchPercent),
      );
    },
  );

  await t.test("replacement changes exactly one item safely", async () => {
    await resetDemo();
    const original = await createRecommendation(broadRequest());
    assert.equal(original.status, "completed");
    const originalIds = contentIds(original);
    const replacedId = originalIds[0];

    const replacement = await jsonRequest(
      `/api/recommendations/${encodeURIComponent(original.runId)}/replacement`,
      { method: "POST", json: { contentId: replacedId } },
    );
    assertStatus(replacement, 200, "replace recommendation");
    assert.equal(replacement.body.status, "completed");
    assert.equal(replacement.body.recommendations.length, originalIds.length);
    assertUniqueContent(replacement.body);

    const replacementIds = contentIds(replacement.body);
    const changedIndexes = replacementIds
      .map((id, index) => (id === originalIds[index] ? -1 : index))
      .filter((index) => index >= 0);
    assert.deepEqual(changedIndexes, [0]);
    assert.ok(!replacementIds.includes(replacedId));
    assert.equal(
      replacement.body.recommendations[0].replacementOf,
      replacedId,
    );
    assert.ok(
      replacement.body.trace.some((event) => event.action === "replacement"),
    );

    const session = await jsonRequest("/api/auth/session");
    assertStatus(session, 200, "read current user");
    const providers = new Set(session.body.user.subscribedProviders);
    assert.ok(
      replacement.body.recommendations[0].content.providers.some((item) =>
        providers.has(item.provider),
      ),
      "replacement must remain available on a subscribed provider",
    );
  });

  await t.test(
    "replacement stays inside policy and can use the budget fallback",
    async () => {
      await resetDemo();
      const original = await createRecommendation(
        broadRequest("budget_fallback"),
      );
      const originalIds = contentIds(original);
      const replacedId = originalIds[0];
      const result = await jsonRequest(
        `/api/recommendations/${encodeURIComponent(original.runId)}/replacement`,
        { method: "POST", json: { contentId: replacedId } },
      );

      assertStatus(result, 200, "replace through budget fallback");
      assert.equal(result.body.status, "completed");
      assert.equal(result.body.recommendations.length, 5);
      assertUniqueContent(result.body);
      assert.ok(!contentIds(result.body).includes(replacedId));
      assert.ok(
        result.body.trace.filter((event) => event.action === "fallback")
          .length >= 2,
        "replacement must pass through its own budget fallback",
      );
      assert.ok(
        result.body.trace.some((event) => event.action === "replacement"),
      );
    },
  );

  await t.test("bookmark records round-trip through engagement and profile", async () => {
    await resetDemo();
    const recommendation = await createRecommendation(broadRequest());
    const contentId = recommendation.recommendations[0].content.id;

    const bookmarked = await jsonRequest("/api/engagement", {
      method: "POST",
      json: {
        userId: "client-supplied-user-must-be-ignored",
        contentId,
        runId: recommendation.runId,
        type: "BOOKMARK",
      },
    });
    assertStatus(bookmarked, 201, "record bookmark");
    assert.equal(bookmarked.body.userId, "demo-adult");
    assert.equal(bookmarked.body.contentId, contentId);
    assert.equal(bookmarked.body.type, "BOOKMARK");

    const library = await jsonRequest("/api/engagement");
    assertStatus(library, 200, "read engagement library");
    assert.ok(
      library.body.events.some(
        (event) =>
          event.contentId === contentId && event.type === "BOOKMARK",
      ),
    );
    assert.ok(
      library.body.contents.some((content) => content.id === contentId),
    );

    const profileAfterBookmark = await jsonRequest("/api/users/profile");
    assertStatus(profileAfterBookmark, 200, "read bookmarked profile");
    assert.ok(profileAfterBookmark.body.bookmarkedContentIds.includes(contentId));

    const unbookmarked = await jsonRequest("/api/engagement", {
      method: "POST",
      json: { contentId, type: "UNBOOKMARK" },
    });
    assertStatus(unbookmarked, 201, "remove bookmark");
    const profileAfterRemoval = await jsonRequest("/api/users/profile");
    assert.ok(
      !profileAfterRemoval.body.bookmarkedContentIds.includes(contentId),
    );
  });

  await t.test("server-renders the MY product screen", async () => {
    const response = await request("/my", {
      headers: { accept: "text/html" },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

    const html = await response.text();
    assert.match(html, /OTT 다모아/);
    assert.match(html, /김민지/);
    assert.match(html, /보관함/);
    assert.match(html, /최근 추천/);
    assert.match(html, /Demo 데이터 초기화/);
  });

  await t.test("reset clears runs and engagement events", async () => {
    const before = await createRecommendation(broadRequest());
    await jsonRequest("/api/engagement", {
      method: "POST",
      json: {
        contentId: before.recommendations[0].content.id,
        type: "WATCHED",
      },
    });

    await resetDemo();

    const runs = await jsonRequest("/api/recommendations");
    assertStatus(runs, 200, "list runs after reset");
    assert.deepEqual(runs.body.runs, []);

    const library = await jsonRequest("/api/engagement");
    assertStatus(library, 200, "list engagement after reset");
    assert.deepEqual(library.body.events, []);
    assert.deepEqual(library.body.contents, []);
  });
});
