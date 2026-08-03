import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

/**
 * 실제 라우트 핸들러를 그대로 불러 인증 흐름을 확인한다. demo 프로필이라
 * 저장소만 메모리이고, 비밀번호 확인과 세션 서명은 live 와 같은 코드를 지난다.
 */
process.env.APP_PROFILE = "demo";
delete process.env.OTT_DAMOA_PROFILE_OVERRIDE;

const root = process.cwd();
const jiti = createJiti(`${root}/package.json`, {
  fsCache: false,
  moduleCache: false,
  alias: { "@": `${root}/src` },
});

const signup = await jiti.import("./src/app/api/account/signup/route.ts");
const session = await jiti.import("./src/app/api/account/session/route.ts");
const watchlist = await jiti.import("./src/app/api/watchlist/route.ts");

const post = (url, body, cookie) =>
  new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });

const get = (url, cookie) =>
  new Request(url, { headers: cookie ? { cookie } : {} });

/** Set-Cookie 헤더에서 요청에 다시 실어 보낼 형태만 뽑는다. */
const cookieFrom = (response) => {
  const raw = response.headers.get("set-cookie");
  return raw ? raw.split(";")[0] : null;
};

let unique = 0;
const nickname = () => `테스터${(unique += 1)}`;

test("API-01: 가입하면 세션 쿠키를 HttpOnly 로 심어준다", async () => {
  const name = nickname();
  const response = await signup.POST(
    post("http://localhost/api/account/signup", {
      nickname: name,
      password: "purple-rain-88",
      birthDate: "1996-04-21",
    }),
  );

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.account.nickname, name);
  assert.equal(body.account.birthDate, undefined, "생년월일을 내려주면 안 된다");
  assert.equal(body.account.passwordHash, undefined);

  const raw = response.headers.get("set-cookie");
  assert.match(raw, /HttpOnly/, "스크립트가 세션을 읽으면 안 된다");
  assert.match(raw, /SameSite=Lax/);
  assert.match(raw, /Path=\//);
});

test("API-02: 같은 별명으로 두 번 가입할 수 없다", async () => {
  const name = nickname();
  const payload = {
    nickname: name,
    password: "purple-rain-88",
    birthDate: "1996-04-21",
  };
  await signup.POST(post("http://localhost/api/account/signup", payload));
  const second = await signup.POST(
    post("http://localhost/api/account/signup", payload),
  );

  assert.equal(second.status, 409);
  assert.equal((await second.json()).code, "NICKNAME_TAKEN");
});

test("API-03: 너무 짧은 비밀번호는 가입 단계에서 막힌다", async () => {
  const tooShort = await signup.POST(
    post("http://localhost/api/account/signup", {
      nickname: nickname(),
      password: "abc",
      birthDate: "1996-04-21",
    }),
  );
  assert.equal(tooShort.status, 400);
  assert.ok((await tooShort.json()).problems.includes("PASSWORD_LENGTH"));

  // 짧고 단순해도 길이만 넘으면 통과한다.
  const simple = await signup.POST(
    post("http://localhost/api/account/signup", {
      nickname: nickname(),
      password: "1234",
      birthDate: "1996-04-21",
    }),
  );
  assert.equal(simple.status, 201);
});

test("API-04: 맞는 비밀번호로만 로그인된다", async () => {
  const name = nickname();
  await signup.POST(
    post("http://localhost/api/account/signup", {
      nickname: name,
      password: "purple-rain-88",
      birthDate: "1996-04-21",
    }),
  );

  const wrong = await session.POST(
    post("http://localhost/api/account/session", {
      nickname: name,
      password: "purple-rain-89",
    }),
  );
  assert.equal(wrong.status, 401);
  assert.equal((await wrong.json()).code, "INVALID_CREDENTIALS");

  const right = await session.POST(
    post("http://localhost/api/account/session", {
      nickname: name,
      password: "purple-rain-88",
    }),
  );
  assert.equal(right.status, 200);
  assert.ok(cookieFrom(right), "로그인하면 세션이 심어져야 한다");
});

test("API-05: 없는 별명과 틀린 비밀번호는 같은 답을 준다", async () => {
  const name = nickname();
  await signup.POST(
    post("http://localhost/api/account/signup", {
      nickname: name,
      password: "purple-rain-88",
      birthDate: "1996-04-21",
    }),
  );

  const missing = await session.POST(
    post("http://localhost/api/account/session", {
      nickname: "존재하지않는별명",
      password: "purple-rain-88",
    }),
  );
  const wrong = await session.POST(
    post("http://localhost/api/account/session", {
      nickname: name,
      password: "purple-rain-89",
    }),
  );

  assert.equal(missing.status, wrong.status);
  assert.deepEqual(
    await missing.json(),
    await wrong.json(),
    "답이 다르면 어떤 별명이 가입돼 있는지 알아낼 수 있다",
  );
});

test("API-06: 세션 조회는 쿠키가 있어야 계정을 준다", async () => {
  const name = nickname();
  const created = await signup.POST(
    post("http://localhost/api/account/signup", {
      nickname: name,
      password: "purple-rain-88",
      birthDate: "1996-04-21",
    }),
  );
  const cookie = cookieFrom(created);

  const anonymous = await session.GET(get("http://localhost/api/account/session"));
  assert.equal((await anonymous.json()).account, null);

  const signed = await session.GET(
    get("http://localhost/api/account/session", cookie),
  );
  assert.equal((await signed.json()).account.nickname, name);
});

test("API-07: 위조한 쿠키로는 남의 계정이 되지 않는다", async () => {
  const created = await signup.POST(
    post("http://localhost/api/account/signup", {
      nickname: nickname(),
      password: "purple-rain-88",
      birthDate: "1996-04-21",
    }),
  );
  const cookie = cookieFrom(created);
  const [key, value] = cookie.split("=");
  const parts = decodeURIComponent(value).split(".");

  // 계정 id 만 바꿔치기한다.
  const forged = `${key}=${encodeURIComponent(`acc_other.${parts[1]}.${parts[2]}`)}`;
  const response = await session.GET(
    get("http://localhost/api/account/session", forged),
  );
  assert.equal((await response.json()).account, null);

  const garbage = `${key}=${encodeURIComponent("아무값")}`;
  const second = await session.GET(
    get("http://localhost/api/account/session", garbage),
  );
  assert.equal((await second.json()).account, null);
});

test("API-08: 로그아웃은 쿠키를 즉시 만료시킨다", async () => {
  const response = await session.DELETE();
  const raw = response.headers.get("set-cookie");
  assert.match(raw, /Max-Age=0/);
  assert.match(raw, /HttpOnly/);
});

test("API-09: 비로그인 상태로는 찜을 읽지도 쓰지도 못한다", async () => {
  const list = await watchlist.GET(get("http://localhost/api/watchlist"));
  assert.equal(list.status, 401);
  assert.equal((await list.json()).code, "UNAUTHORIZED");

  const add = await watchlist.POST(
    post("http://localhost/api/watchlist", { contentId: "any" }),
  );
  assert.equal(add.status, 401);

  const remove = await watchlist.DELETE(
    new Request("http://localhost/api/watchlist", { method: "DELETE" }),
  );
  assert.equal(remove.status, 401);
});

test("API-10: 로그인하면 찜을 담고 다시 읽을 수 있고 계정마다 분리된다", async () => {
  const { withMvpComposition } = await jiti.import("./src/composition/index.ts");
  const [sample] = await withMvpComposition(({ adapters }) =>
    adapters.catalog.list(),
  );
  assert.ok(sample, "demo 카탈로그에 작품이 있어야 이 검사를 할 수 있다");

  const first = cookieFrom(
    await signup.POST(
      post("http://localhost/api/account/signup", {
        nickname: nickname(),
        password: "purple-rain-88",
        birthDate: "1996-04-21",
      }),
    ),
  );
  const second = cookieFrom(
    await signup.POST(
      post("http://localhost/api/account/signup", {
        nickname: nickname(),
        password: "purple-rain-88",
        birthDate: "1996-04-21",
      }),
    ),
  );

  const added = await watchlist.POST(
    post("http://localhost/api/watchlist", { contentId: sample.id }, first),
  );
  assert.equal(added.status, 201);

  // 같은 작품을 다시 담아도 오류가 아니고 한 줄로 남는다.
  await watchlist.POST(
    post("http://localhost/api/watchlist", { contentId: sample.id }, first),
  );

  const mine = await watchlist.GET(get("http://localhost/api/watchlist", first));
  const mineBody = await mine.json();
  assert.equal(mineBody.entries.length, 1);
  assert.equal(mineBody.entries[0].id, sample.id);
  assert.ok(Array.isArray(mineBody.entries[0].providers));

  const theirs = await watchlist.GET(
    get("http://localhost/api/watchlist", second),
  );
  assert.deepEqual(
    (await theirs.json()).entries,
    [],
    "다른 계정의 찜이 보이면 안 된다",
  );
});

test("API-11: 없는 작품 id 는 찜으로 담기지 않는다", async () => {
  const cookie = cookieFrom(
    await signup.POST(
      post("http://localhost/api/account/signup", {
        nickname: nickname(),
        password: "purple-rain-88",
        birthDate: "1996-04-21",
      }),
    ),
  );

  const response = await watchlist.POST(
    post("http://localhost/api/watchlist", { contentId: "없는작품" }, cookie),
  );
  assert.equal(response.status, 400);
});
