import type {
  CatalogRepository,
  SearchAdapter,
  SelectorAdapter,
} from "../../../contracts/ports";
import { RESULT_LIMIT } from "../../../config/recommendation";
import { filterCatalog } from "../../catalog/filtering";
import { scoreSearchResults } from "../scoring";
import type {
  RecommendationExecutionContext,
  RecommendationExecutionResult,
  RecommendationExecutor,
} from "./types";

export class PipelineRecommendationExecutor
  implements RecommendationExecutor
{
  constructor(
    private readonly catalog: CatalogRepository,
    private readonly search: SearchAdapter,
    private readonly selector: SelectorAdapter,
  ) {}

  async execute(
    context: RecommendationExecutionContext,
  ): Promise<RecommendationExecutionResult> {
    const allContents = await context.budget.runTool(() =>
      this.catalog.list(),
    );
    const filtered = filterCatalog(allContents, context.searchInput);
    await context.trace.emit("filter", {
      title: "필수 조건을 먼저 확인했어요",
      description:
        "연령, 국내 시청 가능 여부, 구독 OTT, 시청 시간과 제외 설정을 코드로 검사했습니다.",
      metrics: {
        전체: allContents.length,
        통과: filtered.eligible.length,
        제외: filtered.excluded.length,
      },
    });

    const searchResults = await context.budget.runTool(() =>
      this.search.search(context.searchInput, filtered.eligible),
    );
    await context.trace.emit("vector_search", {
      title: "현재 취향과 가까운 작품을 찾았어요",
      description: context.searchInput.naturalLanguage.trim()
        ? "입력한 자연어 문장을 원문 저장 없이 의미 검색 기준으로 사용했습니다."
        : "선택한 동반자, 분위기, 장르 칩을 한 문장으로 조합해 로컬 의미 검색을 실행했습니다.",
      metrics: {
        검색후보: searchResults.length,
        로컬검색: true,
      },
    });

    const ranked = scoreSearchResults(searchResults, context.searchInput);
    await context.trace.emit("score", {
      title: "여섯 가지 기준으로 점수를 계산했어요",
      description:
        "의미 유사도, 분위기, 장르, 시간, 작품 품질, 동반자 적합도를 정규화하고 컬렉션 중복을 감점했습니다.",
      metrics: {
        점수계산: ranked.length,
        자연어가중치: Boolean(context.searchInput.naturalLanguage.trim()),
      },
    });

    const selected = this.selector.select(ranked, RESULT_LIMIT);
    await context.trace.emit("select", {
      title: `${selected.length}편을 결정론적으로 골랐어요`,
      description:
        "같은 입력은 같은 결과가 되도록 점수와 제목 순서로 안정적으로 정렬했습니다.",
      metrics: {
        최종후보: selected.length,
      },
    });
    context.budget.assertWithinLimits();

    return {
      ranked,
      selected,
      excludedContentIds: filtered.excluded.map(
        ({ content }) => content.id,
      ),
      eligibleCount: filtered.eligible.length,
    };
  }
}