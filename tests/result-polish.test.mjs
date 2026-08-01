import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("result UI uses user-facing and consistent recommendation copy", async () => {
  const [view, card, timeline] = await Promise.all([
    read("src/components/recommendation-view.tsx"),
    read("src/components/content-card.tsx"),
    read("src/components/recommendation-timeline.tsx"),
  ]);

  for (const copy of [
    "정책 확인 완료",
    "공개 가능한 실행 기록",
    "추천 실행 상세",
    "필터 · 검색 · 선택 · 정책 · Trace",
    "RECOMMENDATION RUN",
    "후보 점수 계산",
    "마지막 정책 검사",
  ]) {
    assert.ok(!view.includes(copy), `result UI must not expose "${copy}"`);
  }
  assert.ok(!card.includes("% match"), "match label must not mix English");
  assert.ok(card.includes("취향 일치"), "match label must use the Korean term");
  assert.ok(
    timeline.includes("traceMetricLabels"),
    "trace metrics need user labels",
  );
});

test("approval progress copy reads runtime values from its proposal", async () => {
  const view = await read("src/components/recommendation-view.tsx");

  assert.ok(!view.includes('"45분까지 다시 찾는 중…"'));
  assert.ok(!view.includes('"30분 결과를 정리하는 중…"'));
  assert.ok(!view.includes("<h2>30분 조건에 맞는"));
  assert.ok(view.includes("response.proposal.proposedMaxMinutes"));
  assert.ok(view.includes("response.proposal.currentMaxMinutes"));
});

test("poster and provider card keep shared accessible visual semantics", async () => {
  const [poster, css] = await Promise.all([
    read("src/components/poster-art.tsx"),
    read("src/app/globals.css"),
  ]);

  assert.ok(!poster.includes("데모 포스터"));
  assert.ok(poster.includes("`${content.title} 포스터`"));
  assert.ok(
    css.includes(".choice-card > span:not(.provider-badge)"),
    "provider badge must not inherit generic card span styling",
  );
  assert.ok(
    css.includes(".choice-card.is-selected > span:not(.provider-badge)"),
    "selected provider badge must keep its provider color",
  );
});

test("new public recommendation steps avoid implementation terminology", async () => {
  const policy = await read("src/domains/recommendation/policy.ts");

  for (const copy of [
    "코드로 검사했습니다",
    "vector로 변환해",
    "저장 vector",
    "후보 allowlist",
    "고정 점수 규칙",
    "최종 정책 검사를 통과했어요",
  ]) {
    assert.ok(!policy.includes(copy), `public recommendation copy must not expose "${copy}"`);
  }
});
