import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const rootPath = path.resolve(import.meta.dirname, "..");
const read = (relativePath) =>
  readFile(path.join(rootPath, relativePath), "utf8");

test("LOGOUT-01: 찜이 0편이어도 로그아웃할 수 있다", async () => {
  const view = await read("src/components/watchlist/watchlist-view.tsx");

  // 이 화면은 찜이 0편이면 빈 상태를 반환하고 끝난다. 예전에는 로그아웃이 그
  // 아래 헤더에만 있어서, 방금 가입한 사람은 로그아웃할 방법이 없었다.
  const emptyBranch = view.slice(
    view.indexOf("entries.length === 0"),
    view.indexOf("const covered"),
  );

  assert.ok(
    emptyBranch.length > 0,
    "빈 상태 분기를 찾지 못했다 — 이 검사를 고쳐야 한다",
  );
  assert.ok(
    emptyBranch.includes("LogoutButton"),
    "찜이 0편인 화면에도 로그아웃이 있어야 한다",
  );
});

test("LOGOUT-02: 두 헤더 모두에서 로그아웃할 수 있다", async () => {
  const [landing, shell] = await Promise.all([
    read("src/components/landing/landing-auth.tsx"),
    read("src/components/app-shell.tsx"),
  ]);

  // 홈은 landing-auth, 나머지 화면은 app-shell 이 헤더를 그린다. 한쪽에만 두면
  // 어느 화면에 있느냐에 따라 로그아웃이 사라진다.
  assert.ok(landing.includes("LogoutButton"), "홈 헤더에 로그아웃이 있어야 한다");
  assert.ok(shell.includes("LogoutButton"), "공용 헤더에 로그아웃이 있어야 한다");
});

test("LOGOUT-03: 로그인하지 않았거나 확인 전이면 그리지 않는다", async () => {
  const button = await read("src/components/watchlist/logout-button.tsx");

  // 첫 조회가 끝나기 전에 로그아웃이 스치면 로그인된 줄로 읽힌다.
  assert.match(
    button,
    /if\s*\(loading\s*\|\|\s*!account\)\s*return null;/,
    "loading 중이거나 비로그인이면 아무것도 그리지 않아야 한다",
  );
});

test("LOGOUT-04: 로그아웃은 세션을 서버에서 지운다", async () => {
  const store = await read("src/components/watchlist/watchlist-store.ts");

  // 화면 상태만 비우면 쿠키가 남아 새로고침 한 번에 로그인 상태로 돌아온다.
  assert.ok(
    store.includes('request("/api/account/session", { method: "DELETE" })'),
    "로그아웃은 세션 삭제를 서버에 요청해야 한다",
  );
  assert.ok(
    store.includes("publish({ account: null, entries: [] })"),
    "로그아웃 뒤 화면에 남의 찜 목록이 남아 있으면 안 된다",
  );
});

test("LOGOUT-05: 로그아웃 버튼은 접근성 규약을 지킨다", async () => {
  const button = await read("src/components/watchlist/logout-button.tsx");

  assert.ok(
    button.includes('type="button"'),
    "폼 안에 들어가도 제출로 동작하면 안 된다",
  );
  assert.ok(
    button.includes("focus-visible:outline"),
    "키보드 초점이 보여야 한다",
  );
  assert.ok(button.includes("min-h-11"), "터치 대상이 충분해야 한다");
  assert.ok(
    !/text-xs|text-\[1[0-3]px\]/.test(button),
    "본문 글자가 14px 아래로 내려가면 안 된다",
  );
});
