import assert from "node:assert/strict";
import test from "node:test";

import {
  applySessionSecret,
  generateSessionSecret,
  SESSION_SECRET_KEY,
} from "../scripts/setup-env.mjs";

const SECRET = "TESTSECRETVALUE";

const EXISTING_LOCAL = [
  "APP_PROFILE=live",
  "DATABASE_URL=postgresql://user:pw@host:5432/db",
  "SESSION_SECRET=",
  "OPENAI_API_KEY=sk-example",
].join("\n");

test("ENV-01: 비어 있는 SESSION_SECRET 을 채운다", () => {
  const { contents, outcome } = applySessionSecret(EXISTING_LOCAL, SECRET);

  assert.equal(outcome, "filled");
  assert.match(contents, new RegExp(`^${SESSION_SECRET_KEY}=${SECRET}$`, "m"));
});

test("ENV-02: 이미 값이 있으면 건드리지 않는다", () => {
  const already = EXISTING_LOCAL.replace(
    "SESSION_SECRET=",
    "SESSION_SECRET=이미있는값",
  );

  const { contents, outcome } = applySessionSecret(already, SECRET);

  // 이 파일에는 각자의 자격증명이 들어 있어 덮어쓰면 되돌릴 수 없다.
  assert.equal(outcome, "already-set");
  assert.equal(contents, already);
  assert.ok(!contents.includes(SECRET));
});

test("ENV-03: 다른 줄을 보존한다", () => {
  const { contents } = applySessionSecret(EXISTING_LOCAL, SECRET);

  assert.match(contents, /^APP_PROFILE=live$/m);
  assert.match(contents, /^DATABASE_URL=postgresql:\/\/user:pw@host:5432\/db$/m);
  assert.match(contents, /^OPENAI_API_KEY=sk-example$/m);
});

test("ENV-04: 키가 없으면 끝에 추가한다", () => {
  const withoutKey = "APP_PROFILE=demo\nDATABASE_URL=\n";

  const { contents, outcome } = applySessionSecret(withoutKey, SECRET);

  assert.equal(outcome, "appended");
  assert.match(contents, new RegExp(`^${SESSION_SECRET_KEY}=${SECRET}$`, "m"));
  assert.match(contents, /^APP_PROFILE=demo$/m);
});

test("ENV-05: 마지막 줄에 줄바꿈이 없어도 붙여 쓰지 않는다", () => {
  const { contents } = applySessionSecret("APP_PROFILE=demo", SECRET);

  assert.match(contents, /^APP_PROFILE=demo$/m);
  assert.match(contents, new RegExp(`^${SESSION_SECRET_KEY}=${SECRET}$`, "m"));
});

test("ENV-06: 주석은 설정으로 보지 않는다", () => {
  const commented = `# ${SESSION_SECRET_KEY}=설명용예시\nAPP_PROFILE=demo\n`;

  const { contents, outcome } = applySessionSecret(commented, SECRET);

  // 주석만 보고 "이미 설정됨"으로 판단하면 아무도 값을 못 받는다.
  assert.equal(outcome, "appended");
  assert.match(contents, new RegExp(`^${SESSION_SECRET_KEY}=${SECRET}$`, "m"));
  assert.match(contents, new RegExp(`^# ${SESSION_SECRET_KEY}=설명용예시$`, "m"));
});

test("ENV-07: CRLF 파일은 CRLF 를 유지한다", () => {
  const crlf = "APP_PROFILE=live\r\nSESSION_SECRET=\r\n";

  const { contents } = applySessionSecret(crlf, SECRET);

  // Windows 에서 편집한 파일을 LF 로 바꿔 쓰면 diff 가 통째로 뒤집힌다.
  assert.ok(contents.includes(`${SESSION_SECRET_KEY}=${SECRET}\r\n`));
  assert.ok(!/[^\r]\n/.test(contents));
});

test("ENV-08: 생성한 키는 매번 다르고 추측할 수 없을 만큼 길다", () => {
  const keys = new Set(
    Array.from({ length: 20 }, () => generateSessionSecret()),
  );

  assert.equal(keys.size, 20);
  for (const key of keys) {
    // 32바이트를 base64url 로 적으면 43자가 된다.
    assert.equal(key.length, 43);
    assert.match(key, /^[A-Za-z0-9_-]+$/);
  }
});
