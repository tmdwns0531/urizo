import { createPrismaBatchAdapters } from "../src/adapters/prisma/node-factory";
import { createTmdbClient } from "../src/integrations/tmdb/client";
import {
  buildCatalogSearchDocument,
  normalizeTmdbDetail,
} from "../src/integrations/tmdb/normalization";

/**
 * 저장된 카탈로그를 TMDB ID 로 하나씩 다시 조회해 태그·문서를 갱신한다.
 * discover 로 다시 찾는 것이 아니라 이미 가진 작품만 훑는다.
 *
 * 왜 필요한가: 분위기·동반자 태그는 TMDB keyword 에서 나오는데 그 keyword 를
 * DB 에 저장하지 않는다. 그래서 태깅 규칙을 고쳐도 "이번 수집에서 다시 발견된"
 * 작품만 새 규칙을 받고 나머지는 옛 태그로 남는다. discover 결과는 날마다
 * 달라서 전체가 다시 잡히는 일은 없다 — 실제로 태깅 교정 후에도 해리 포터와
 * 반지의 제왕이 옛 `어두운` 태그를 그대로 들고 있었다.
 *
 * 검색 문서도 함께 다시 만든다. 문서 형식만 바뀐 경우라면 저장된 필드만으로도
 * 충분하지만, 태그를 바꾸려면 어차피 TMDB 를 다시 불러야 해서 한 경로로 둔다.
 */

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`MISSING_${name}`);
  return value;
}

async function main(): Promise<void> {
  const prisma = createPrismaBatchAdapters(required("DATABASE_URL"));
  const source = createTmdbClient({
    credential: { kind: "api-key", value: required("TMDB_API_KEY") },
    fetchImpl: globalThis.fetch,
    language: process.env.TMDB_LANGUAGE?.trim() || "ko-KR",
    region: process.env.TMDB_REGION?.trim() || "KR",
  });

  try {
    const contents = await prisma.catalog.list();
    let refreshed = 0;
    let deactivated = 0;
    let failed = 0;
    let tagsChanged = 0;

    for (const content of contents) {
      const mediaKind = content.mediaType === "MOVIE" ? "movie" : "tv";
      let detail;
      try {
        detail = mediaKind === "movie"
          ? await source.getDetails("movie", content.tmdbId)
          : await source.getDetails("tv", content.tmdbId);
      } catch {
        // 개별 작품 조회 실패는 전체를 멈추지 않는다. 기존 행은 그대로 둔다.
        failed += 1;
        continue;
      }

      const normalized = normalizeTmdbDetail(mediaKind, detail);
      if (!normalized.ok || normalized.content.tmdbId !== content.tmdbId) {
        if (await prisma.catalog.deactivateCatalog(
          content.tmdbId,
          content.mediaType,
        )) {
          deactivated += 1;
        }
        continue;
      }

      const before = [...content.moodTags].sort().join("|");
      const after = [...normalized.content.moodTags].sort().join("|");
      if (before !== after) {
        tagsChanged += 1;
      }

      const searchDocument = await buildCatalogSearchDocument(
        normalized.content,
      );
      await prisma.catalog.upsertCatalog({
        content: normalized.content,
        searchDocument,
      });
      refreshed += 1;
    }

    console.log(
      JSON.stringify({
        event: "CATALOG_REFRESH_COMPLETE",
        contents: contents.length,
        refreshed,
        tagsChanged,
        deactivated,
        failed,
      }),
    );
  } finally {
    await prisma.disconnect();
  }
}

main().catch(() => {
  console.error("CATALOG_REFRESH_FAILED");
  process.exitCode = 1;
});
