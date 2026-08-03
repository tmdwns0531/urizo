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

async function loadModule(filePath) {
  return import(await moduleDataUrl(filePath));
}

const read = (filePath) =>
  readFile(new URL(`../${filePath}`, import.meta.url), "utf8");

const COVERAGE = "src/domains/watchlist/coverage.ts";

const entry = (id, providers, title = `작품 ${id}`) => ({
  id,
  title,
  posterUrl: null,
  providers,
});

test("WATCH-01: 단독 커버리지는 편수 내림차순이고 0편인 OTT는 빠진다", async () => {
  const { buildCoveragePlan } = await loadModule(COVERAGE);

  const plan = buildCoveragePlan([
    entry("a", ["NETFLIX", "WAVVE"]),
    entry("b", ["NETFLIX"]),
    entry("c", ["NETFLIX"]),
    entry("d", ["WAVVE"]),
  ]);

  assert.equal(plan.saved, 4);
  assert.deepEqual(
    plan.single.map((reach) => [reach.provider, reach.count]),
    [
      ["NETFLIX", 3],
      ["WAVVE", 2],
    ],
  );
  assert.ok(
    !plan.single.some((reach) => reach.provider === "TVING"),
    "찜한 작품이 없는 OTT는 목록에 넣지 않는다",
  );
});

test("WATCH-02: 조합은 한계 이득이 큰 순서로 쌓이고 누적이 맞는다", async () => {
  const { buildCoveragePlan } = await loadModule(COVERAGE);

  // NETFLIX 3편, WAVVE 는 그중 1편이 겹치고 1편이 새롭다.
  const plan = buildCoveragePlan([
    entry("a", ["NETFLIX"]),
    entry("b", ["NETFLIX"]),
    entry("c", ["NETFLIX", "WAVVE"]),
    entry("d", ["WAVVE"]),
  ]);

  assert.deepEqual(plan.steps, [
    { provider: "NETFLIX", added: 3, total: 3 },
    { provider: "WAVVE", added: 1, total: 4 },
  ]);
});

test("WATCH-03: 이미 다 덮은 뒤에는 OTT를 더 넣지 않는다", async () => {
  const { buildCoveragePlan } = await loadModule(COVERAGE);

  // TVING 은 NETFLIX 가 덮은 작품만 갖고 있어 추가 이득이 0 이다.
  const plan = buildCoveragePlan([
    entry("a", ["NETFLIX", "TVING"]),
    entry("b", ["NETFLIX", "TVING"]),
  ]);

  assert.equal(plan.steps.length, 1);
  assert.deepEqual(plan.steps[0], {
    provider: "NETFLIX",
    added: 2,
    total: 2,
  });
});

test("WATCH-04: 동점이면 고정된 OTT 순서로 끊어 결과가 흔들리지 않는다", async () => {
  const { buildCoveragePlan } = await loadModule(COVERAGE);

  const first = buildCoveragePlan([entry("a", ["WAVVE", "NETFLIX"])]);
  const second = buildCoveragePlan([entry("a", ["NETFLIX", "WAVVE"])]);

  assert.equal(first.steps[0].provider, "NETFLIX");
  assert.equal(
    second.steps[0].provider,
    "NETFLIX",
    "입력 순서가 달라도 같은 답이어야 한다",
  );
});

test("WATCH-05: 국내 OTT가 없는 작품은 미커버로 분리하고 조합을 막지 않는다", async () => {
  const { buildCoveragePlan } = await loadModule(COVERAGE);

  const plan = buildCoveragePlan([
    entry("a", ["NETFLIX"]),
    entry("b", [], "어디에도 없는 작품"),
  ]);

  assert.equal(plan.uncovered.length, 1);
  assert.equal(plan.uncovered[0].title, "어디에도 없는 작품");
  assert.deepEqual(plan.steps, [{ provider: "NETFLIX", added: 1, total: 1 }]);
});

test("WATCH-06: 저장 값이 낡아 모르는 OTT가 들어와도 무시한다", async () => {
  const { buildCoveragePlan } = await loadModule(COVERAGE);

  // 예전 저장본이 지금은 없는 OTT 이름을 갖고 있을 수 있다.
  const plan = buildCoveragePlan([entry("a", ["DISNEY_PLUS", "SEEZN"])]);

  assert.deepEqual(
    plan.single.map((reach) => reach.provider),
    ["DISNEY_PLUS"],
  );
  assert.equal(plan.uncovered.length, 0);
});

test("WATCH-07: 빈 목록은 빈 계획을 낸다", async () => {
  const { buildCoveragePlan } = await loadModule(COVERAGE);

  const plan = buildCoveragePlan([]);
  assert.deepEqual(plan, { saved: 0, single: [], steps: [], uncovered: [] });
});

test("WATCH-08: 찜 저장은 화면 계층에만 두고 도메인은 브라우저를 모른다", async () => {
  const coverage = await read(COVERAGE);

  for (const forbidden of ["localStorage", "window", "document"]) {
    assert.ok(
      !coverage.includes(forbidden),
      `커버리지 계산은 ${forbidden} 을 알면 안 된다 — 서버로 옮길 때 걸린다`,
    );
  }
});

test("WATCH-09: 찜 버튼과 목록은 접근성 규약을 지킨다", async () => {
  const [button, view, nav] = await Promise.all([
    read("src/components/watchlist/watchlist-button.tsx"),
    read("src/components/watchlist/watchlist-view.tsx"),
    read("src/components/watchlist/watchlist-nav-link.tsx"),
  ]);

  assert.ok(
    button.includes("aria-pressed"),
    "찜 버튼은 눌린 상태를 알려야 한다",
  );
  assert.ok(
    button.includes("aria-label"),
    "아이콘만 있는 버튼은 이름이 필요하다",
  );
  for (const [name, source] of [
    ["button", button],
    ["view", view],
    ["nav", nav],
  ]) {
    assert.ok(
      !/text-xs|text-\[1[0-3]px\]/.test(source),
      `${name} 의 본문 글자가 14px 아래로 내려가면 안 된다`,
    );
    assert.ok(
      source.includes("focus-visible:outline"),
      `${name} 는 키보드 초점이 보여야 한다`,
    );
  }
});

test("WATCH-10: 찜 화면은 저장 방식을 모르고 문구는 한국어다", async () => {
  const view = await read("src/components/watchlist/watchlist-view.tsx");

  // 화면은 저장 위치를 몰라야 서버로 옮길 때 이 파일을 안 건드린다.
  for (const term of ["localStorage", "sessionStorage", "OTT_PROVIDERS"]) {
    assert.ok(
      !view.includes(term),
      `찜 화면이 ${term} 을 직접 알면 저장소를 바꿀 때 함께 고쳐야 한다`,
    );
  }

  for (const copy of [
    "어느 OTT를 구독하면 좋을까요",
    "찜 목록",
    "국내 OTT에서 확인되지 않았어요",
  ]) {
    assert.ok(view.includes(copy), `사람이 읽는 문구가 필요하다: ${copy}`);
  }
});
