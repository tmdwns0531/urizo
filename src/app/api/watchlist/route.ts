import { withMvpComposition } from "@/composition";
import { withAccountComposition } from "@/composition/account";
import type { CatalogContent } from "@/contracts/catalog";
import type { WatchlistEntry } from "@/domains/watchlist/coverage";
import {
  currentAccount,
  fail,
  logServerError,
  ok,
  readJsonObject,
  readString,
} from "../account/_shared";

/**
 * 화면이 커버리지를 계산하려면 작품 정보가 필요한데, 찜 표에는 작품 id 만 있다.
 * 그래서 조회할 때 카탈로그에서 채워 내려준다 — 제목·포스터를 찜 표에 복사해
 * 두면 작품 정보가 바뀌어도 옛 값이 남는다.
 */
const toEntry = (content: CatalogContent): WatchlistEntry => ({
  id: content.id,
  title: content.title,
  posterUrl: content.posterUrl,
  providers: content.providers.map((availability) => availability.provider),
});

export async function GET(request: Request): Promise<Response> {
  try {
    const account = await currentAccount(request);
    if (!account) return fail("UNAUTHORIZED", "로그인이 필요해요.");

    const saved = await withAccountComposition(({ watchlist }) =>
      watchlist.list(account.id),
    );
    if (saved.length === 0) return ok({ entries: [] });

    const entries = await withMvpComposition(async ({ adapters }) => {
      const found = await Promise.all(
        saved.map((item) => adapters.catalog.getById(item.contentId)),
      );
      // 카탈로그에서 사라진 작품은 조용히 뺀다. 목록에 빈 칸을 보여줄 이유가 없다.
      return found.filter((content): content is CatalogContent => content !== null)
        .map(toEntry);
    });

    return ok({ entries });
  } catch (error) {
    logServerError("watchlist.GET", error);
    return fail("INTERNAL_ERROR", "찜 목록을 불러오지 못했어요.");
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const account = await currentAccount(request);
    if (!account) return fail("UNAUTHORIZED", "로그인이 필요해요.");

    const body = await readJsonObject(request);
    const contentId = body ? readString(body, "contentId").trim() : "";
    if (!contentId) return fail("BAD_REQUEST", "어떤 작품인지 알 수 없어요.");

    // 없는 작품 id 로 행이 쌓이지 않도록 먼저 확인한다.
    const content = await withMvpComposition(({ adapters }) =>
      adapters.catalog.getById(contentId),
    );
    if (!content) return fail("BAD_REQUEST", "찾을 수 없는 작품이에요.");

    await withAccountComposition(({ watchlist }) =>
      watchlist.add(account.id, contentId),
    );
    return ok({ entry: toEntry(content) }, { status: 201 });
  } catch (error) {
    logServerError("watchlist.POST", error);
    return fail("INTERNAL_ERROR", "찜하지 못했어요.");
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const account = await currentAccount(request);
    if (!account) return fail("UNAUTHORIZED", "로그인이 필요해요.");

    const contentId = new URL(request.url).searchParams.get("contentId")?.trim();
    return await withAccountComposition(async ({ watchlist }) => {
      if (contentId) {
        await watchlist.remove(account.id, contentId);
      } else {
        // id 가 없으면 전체 비우기다. 화면의 "전체 비우기" 가 이 경로를 쓴다.
        await watchlist.clear(account.id);
      }
      return ok({ ok: true });
    });
  } catch (error) {
    logServerError("watchlist.DELETE", error);
    return fail("INTERNAL_ERROR", "찜을 지우지 못했어요.");
  }
}
