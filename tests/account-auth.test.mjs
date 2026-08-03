import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const rootPath = path.resolve(import.meta.dirname, "..");
const moduleCache = new Map();

function resolveTypeScriptModule(fromPath, specifier) {
  const base = path.resolve(path.dirname(fromPath), specifier);
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Cannot resolve ${specifier} from ${fromPath}`);
}

async function moduleDataUrl(filePath) {
  const absolutePath = path.resolve(rootPath, filePath);
  if (moduleCache.has(absolutePath)) return moduleCache.get(absolutePath);

  const pending = (async () => {
    const source = await readFile(absolutePath, "utf8");
    let output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: absolutePath,
    }).outputText;
    const matches = [
      ...output.matchAll(/(?:from\s+|import\s+)(["'])(\.[^"']+)\1/g),
    ];
    for (const match of matches.reverse()) {
      const specifier = match[2];
      const specifierOffset = match[0].lastIndexOf(specifier);
      const start = match.index + specifierOffset;
      const dependency = resolveTypeScriptModule(absolutePath, specifier);
      const dependencyUrl = await moduleDataUrl(dependency);
      output =
        output.slice(0, start) +
        dependencyUrl +
        output.slice(start + specifier.length);
    }
    return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
  })();
  moduleCache.set(absolutePath, pending);
  return pending;
}

const loadModule = async (filePath) => import(await moduleDataUrl(filePath));

const SIGNUP = "src/domains/account/signup.ts";
const PASSWORD = "src/domains/account/password.ts";
const SESSION = "src/domains/account/session.ts";

const TODAY = new Date("2026-08-03T00:00:00Z");
const valid = {
  nickname: "달빛고양이",
  password: "purple-rain-88",
  birthDate: "1996-04-21",
};

test("AUTH-01: 올바른 가입 입력은 통과하고 별명 앞뒤 공백은 다듬는다", async () => {
  const { validateSignup } = await loadModule(SIGNUP);

  const result = validateSignup({ ...valid, nickname: "  달빛고양이 " }, TODAY);
  assert.equal(result.ok, true);
  assert.equal(result.value.nickname, "달빛고양이");
  assert.equal(
    result.value.password,
    valid.password,
    "비밀번호는 다듬지 않는다 — 공백도 사용자가 정한 값이다",
  );
});

test("AUTH-02: 별명 규칙을 어기면 사유가 나온다", async () => {
  const { validateSignup } = await loadModule(SIGNUP);

  assert.deepEqual(
    validateSignup({ ...valid, nickname: "가" }, TODAY).problems,
    ["NICKNAME_LENGTH"],
  );
  assert.deepEqual(
    validateSignup({ ...valid, nickname: "달빛 고양이" }, TODAY).problems,
    ["NICKNAME_CHARSET"],
    "공백이 든 별명은 눈으로 구분이 안 되는 계정을 만든다",
  );
});

test("AUTH-03: 비밀번호는 길이만 본다", async () => {
  const { validateSignup, PASSWORD_MIN, PASSWORD_MAX } =
    await loadModule(SIGNUP);

  const problemsFor = (password) =>
    validateSignup({ ...valid, password }, TODAY).problems;

  assert.equal(PASSWORD_MIN, 4);
  assert.deepEqual(problemsFor("abc"), ["PASSWORD_LENGTH"]);
  assert.deepEqual(problemsFor("a".repeat(PASSWORD_MAX + 1)), [
    "PASSWORD_LENGTH",
  ]);

  // 복잡도 규칙은 두지 않는다. 이 계정이 담는 것은 찜 목록뿐이다.
  for (const password of ["1234", "password", "aaaa", "달빛고양이"]) {
    assert.equal(
      validateSignup({ ...valid, password }, TODAY).ok,
      true,
      `${password} 는 통과해야 한다`,
    );
  }
});

test("AUTH-04: 달력에 없는 날짜와 미래 생년월일을 막는다", async () => {
  const { validateSignup } = await loadModule(SIGNUP);

  const problemsFor = (birthDate) =>
    validateSignup({ ...valid, birthDate }, TODAY).problems;

  assert.deepEqual(problemsFor("1996-02-30"), ["BIRTH_DATE_FORMAT"]);
  assert.deepEqual(problemsFor("1996/04/21"), ["BIRTH_DATE_FORMAT"]);
  assert.deepEqual(problemsFor("2030-01-01"), ["BIRTH_DATE_RANGE"]);
});

test("AUTH-05: 만 나이는 생일이 지났는지까지 따진다", async () => {
  const { ageOn } = await loadModule(SIGNUP);

  assert.equal(ageOn("1996-04-21", TODAY), 30, "생일이 지났으면 만 30세");
  assert.equal(ageOn("1996-12-25", TODAY), 29, "생일 전이면 한 살 적다");
  assert.equal(ageOn("2026-08-03", TODAY), 0);
});

test("AUTH-06: 같은 비밀번호도 저장 값이 매번 다르고 확인은 통과한다", async () => {
  const { hashPassword, verifyPassword } = await loadModule(PASSWORD);

  const first = await hashPassword("purple-rain-88");
  const second = await hashPassword("purple-rain-88");

  assert.notEqual(first, second, "salt 가 매번 달라야 한다");
  assert.ok(!first.includes("purple-rain-88"), "평문이 남으면 안 된다");
  assert.ok(first.startsWith("pbkdf2$"), "형식에 알고리즘과 반복수를 남긴다");
  assert.equal(await verifyPassword("purple-rain-88", first), true);
  assert.equal(await verifyPassword("purple-rain-88", second), true);
});

test("AUTH-07: 틀린 비밀번호와 깨진 저장 값은 통과하지 못한다", async () => {
  const { hashPassword, verifyPassword } = await loadModule(PASSWORD);

  const stored = await hashPassword("purple-rain-88");
  assert.equal(await verifyPassword("purple-rain-89", stored), false);
  assert.equal(await verifyPassword("", stored), false);
  assert.equal(await verifyPassword("purple-rain-88", "garbage"), false);
  assert.equal(await verifyPassword("purple-rain-88", "pbkdf2$0$a$b"), false);
});

test("AUTH-08: 세션 토큰은 서명한 키로만 열린다", async () => {
  const { createSessionToken, readSessionToken } = await loadModule(SESSION);

  const token = await createSessionToken("acc_1", "secret-one", TODAY);
  assert.equal(await readSessionToken(token, "secret-one", TODAY), "acc_1");
  assert.equal(
    await readSessionToken(token, "secret-two", TODAY),
    null,
    "다른 키로는 열리면 안 된다",
  );
});

test("AUTH-09: 위조하거나 만료된 토큰을 거부한다", async () => {
  const { createSessionToken, readSessionToken, SESSION_MAX_AGE_SECONDS } =
    await loadModule(SESSION);

  const token = await createSessionToken("acc_1", "secret-one", TODAY);

  // 계정 id 만 바꿔치기해도 서명이 안 맞는다.
  const forged = `acc_2.${token.split(".")[1]}.${token.split(".")[2]}`;
  assert.equal(await readSessionToken(forged, "secret-one", TODAY), null);

  assert.equal(await readSessionToken("아무말", "secret-one", TODAY), null);
  assert.equal(await readSessionToken("a.b.c", "secret-one", TODAY), null);

  const afterExpiry = new Date(
    TODAY.getTime() + (SESSION_MAX_AGE_SECONDS + 60) * 1000,
  );
  assert.equal(await readSessionToken(token, "secret-one", afterExpiry), null);
});

test("AUTH-10: live 는 세션 키가 없으면 뜨지 않고 demo 는 난수를 쓴다", async () => {
  const { resolveSessionSecret } = await loadModule(SESSION);

  assert.throws(
    () => resolveSessionSecret("live", undefined),
    /SESSION_SECRET/,
    "기본값으로 서명하면 누구나 남의 세션을 위조한다",
  );
  assert.throws(() => resolveSessionSecret("live", "   "));
  assert.equal(resolveSessionSecret("live", "real-secret"), "real-secret");

  const demoFirst = resolveSessionSecret("demo", undefined);
  assert.ok(demoFirst.length >= 32, "demo 키도 추측 가능하면 안 된다");
  assert.equal(
    resolveSessionSecret("demo", undefined),
    demoFirst,
    "한 프로세스 안에서는 같은 키를 써야 로그인이 유지된다",
  );
});

test("AUTH-11: 비밀번호 해시와 생년월일은 공개 계약에 없다", async () => {
  const contract = await readFile(
    new URL("../src/contracts/account.ts", import.meta.url),
    "utf8",
  );

  const publicAccount = contract.slice(
    contract.indexOf("interface PublicAccount"),
    contract.indexOf("interface WatchlistItem"),
  );
  assert.ok(
    !publicAccount.includes("birthDate") &&
      !publicAccount.includes("passwordHash"),
    "화면으로 내려보내는 형태에 생년월일·해시가 있으면 안 된다",
  );
});
