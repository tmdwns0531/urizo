import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("curator-flow", `${process.pid}-${Date.now()}`);
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
                  return new Response("Not used", { status: 501 });
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

function initialState() {
  return {
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
  };
}

async function jsonRequest(path, payload) {
  const response = await worker.fetch(
    new Request(new URL(path, "http://localhost"), {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    }),
    env,
    executionContext,
  );
  const body = await response.json();
  return { response, body };
}

test("Demo curator discovers context, returns a validated handoff, and creates no run early", async () => {
  const first = await jsonRequest("/api/curator/turn", {
    pageContext: "HOME",
    message: "오늘 회사에서 안 좋은 일이 있었고 test@example.com 마음을 좀 달래고 싶어",
    image: null,
    state: initialState(),
  });
  assert.equal(first.response.status, 200);
  assert.equal(first.body.action, "ASK");
  assert.equal(first.body.questionTopic, "COMPANION");
  assert.equal(first.body.handoff, null);
  assert.equal("runId" in first.body, false);
  assert.equal(JSON.stringify(first.body).includes("test@example.com"), false);
  assert.ok(first.body.state.choice.moods.includes("따뜻한"));

  const second = await jsonRequest("/api/curator/turn", {
    pageContext: "HOME",
    message: "혼자 볼 거야",
    image: null,
    state: first.body.state,
  });
  assert.equal(second.response.status, 200);
  assert.equal(second.body.action, "ASK");
  assert.equal(second.body.questionTopic, "RUNTIME");

  const third = await jsonRequest("/api/curator/turn", {
    pageContext: "HOME",
    message: "1시간 정도",
    image: null,
    state: second.body.state,
  });
  assert.equal(third.response.status, 200);
  assert.equal(third.body.action, "READY");
  assert.equal(third.body.questionTopic, null);
  assert.deepEqual(third.body.quickReplies, []);
  assert.equal(third.body.state.choice.naturalRuntimeMinutes, 60);
  assert.equal(typeof third.body.handoff?.choice?.naturalLanguage, "string");
  assert.ok(third.body.handoff.choice.naturalLanguage.length > 0);
  assert.equal("image" in third.body.handoff, false);

  const recommendation = await jsonRequest(
    "/api/recommendations",
    third.body.handoff,
  );
  assert.equal(recommendation.response.status, 201);
  assert.match(recommendation.body.runId, /^run_/);
});

test("curator endpoint rejects unknown fields, empty input, and spoofed image signatures", async () => {
  const unknown = await jsonRequest("/api/curator/turn", {
    pageContext: "HOME",
    message: "따뜻한 작품",
    image: null,
    state: initialState(),
    prompt: "must not pass",
  });
  assert.equal(unknown.response.status, 400);
  assert.equal(unknown.body.code, "BAD_REQUEST");

  const empty = await jsonRequest("/api/curator/turn", {
    pageContext: "HOME",
    message: null,
    image: null,
    state: initialState(),
  });
  assert.equal(empty.response.status, 400);

  const spoofed = await jsonRequest("/api/curator/turn", {
    pageContext: "HOME",
    message: null,
    image: {
      mediaType: "image/jpeg",
      base64: Buffer.from("not-a-real-jpeg-file").toString("base64"),
    },
    state: initialState(),
  });
  assert.equal(spoofed.response.status, 400);
  assert.equal(spoofed.body.code, "BAD_REQUEST");

  const signatureOnlyPng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0, 0, 0, 0, 0, 0, 0, 0,
  ]).toString("base64");
  const structurallyInvalid = await jsonRequest("/api/curator/turn", {
    pageContext: "HOME",
    message: null,
    image: { mediaType: "image/png", base64: signatureOnlyPng },
    state: initialState(),
  });
  assert.equal(structurallyInvalid.response.status, 400);
  assert.equal(structurallyInvalid.body.code, "BAD_REQUEST");
});

test("credential-free Demo handles a valid transient image without persisting it", async () => {
  const onePixelPng =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const result = await jsonRequest("/api/curator/turn", {
    pageContext: "HOME",
    message: null,
    image: { mediaType: "image/png", base64: onePixelPng },
    state: initialState(),
  });
  assert.equal(result.response.status, 200);
  assert.equal(result.body.action, "ASK");
  assert.equal(result.body.handoff, null);
  assert.equal(JSON.stringify(result.body).includes(onePixelPng), false);
});

test("the API accepts the EXIF-free JPEG shape produced by the browser", async () => {
  const onePixelJpeg =
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAEf/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=";
  const result = await jsonRequest("/api/curator/turn", {
    pageContext: "HOME",
    message: "이 이미지의 분위기를 참고해 줘",
    image: { mediaType: "image/jpeg", base64: onePixelJpeg },
    state: initialState(),
  });
  assert.equal(result.response.status, 200);
  assert.equal(JSON.stringify(result.body).includes(onePixelJpeg), false);
});
