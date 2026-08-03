import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("global curator is isolated, accessible, responsive, and memory-only", async () => {
  const [
    layout,
    widget,
    css,
    imageHelper,
    route,
    contract,
    recommendationContract,
  ] =
    await Promise.all([
      read("src/app/layout.tsx"),
      read("src/components/curator/curator-root.tsx"),
      read("src/components/curator/curator-widget.module.css"),
      read("src/components/curator/curator-image.ts"),
      read("src/app/api/curator/turn/route.ts"),
      read("src/contracts/curator.ts"),
      read("src/contracts/mvp-api.ts"),
    ]);

  assert.match(layout, /<CuratorRoot\s*\/>/);
  assert.match(widget, /role="dialog"/);
  assert.match(widget, /aria-modal="true"/);
  assert.match(widget, /aria-haspopup="dialog"/);
  assert.match(widget, /event\.key === "Escape"/);
  assert.match(widget, /nativeEvent\.isComposing/);
  assert.match(widget, /event\.key !== "Tab"/);
  assert.match(widget, /shell\.inert = true/);
  assert.match(widget, /URL\.revokeObjectURL/);
  assert.match(widget, /messageImageUrls/);
  assert.match(widget, /onPaste=\{pasteImage\}/);
  assert.match(widget, /onDragEnter=\{dragImage\}/);
  assert.match(widget, /onDrop=\{dropImage\}/);
  assert.match(widget, /clipboardData\.items/);
  assert.match(widget, /dataTransfer\.files/);
  assert.match(widget, /이미지 준비 완료/);
  assert.match(widget, /aria-label="이미지 첨부 준비 완료"/);
  assert.match(widget, /message\.image\.previewUrl/);
  assert.match(imageHelper, /file\.name\.trim\(\) \|\| "붙여넣은 이미지"/);
  assert.match(css, /\.dropOverlay/);
  assert.match(css, /\.messageImage/);
  assert.match(widget, /recommendationRequest\.current\?\.abort/);
  assert.match(widget, /\/api\/curator\/turn/);
  assert.match(widget, /\/api\/recommendations/);
  assert.doesNotMatch(widget, /localStorage|sessionStorage|indexedDB/i);
  assert.match(widget, /childAgeRatingLimit/);
  assert.match(widget, /companionAvoidGenres/);
  assert.match(widget, /state\.searchQuery/);
  assert.match(css, /width: min\(384px,/);
  assert.match(css, /height: min\(86dvh,/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(route, /CURATOR_REQUEST_MAX_BYTES/);
  assert.match(route, /withCuratorComposition/);
  assert.match(contract, /CURATOR_API_ENDPOINT/);
  assert.doesNotMatch(recommendationContract, /curator/);
});

test("curator route remains separate from public search and persistence", async () => {
  const [route, composition, service, schema, deterministic, openAiAdapter] =
    await Promise.all([
    read("src/app/api/curator/turn/route.ts"),
    read("src/composition/curator.ts"),
    read("src/domains/curator/conversation.ts"),
    read("prisma/schema.prisma"),
    read("src/domains/curator/deterministic-interpreter.ts"),
    read("src/adapters/curator/openai-curator-adapter.ts"),
  ]);
  assert.doesNotMatch(route, /api\/search|RecommendationRun|AgentTrace/);
  assert.doesNotMatch(composition, /Prisma|pgvector|DATABASE_URL/);
  assert.match(service, /resolveMvpRecommendationRequest/);
  assert.match(service, /requireMeaningfulChoice: true/);
  assert.match(deterministic, /parseNaturalInput/);
  assert.doesNotMatch(openAiAdapter, /domains\/curator|domains\/recommendation/);
  // 6 -> 8: v0.9 에서 승인받은 Account, WatchlistItem 이 늘었다. 이 검사의 뜻은
  // "curator 가 모델을 늘리지 않는다" 이고, 위의 doesNotMatch 들이 그것을 지킨다.
  assert.equal((schema.match(/^model\s+/gm) ?? []).length, 8);
});
