import type { RecommendationSelectorAdapter } from "../../contracts/mvp-ports";
import type { SelectorOutput } from "../../contracts/mvp-recommendation";
import type { RecommendationItem } from "../../contracts/recommendation";

const normalizeLimit = (limit: number): number =>
  Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;

export class DeterministicSelectorAdapter
  implements RecommendationSelectorAdapter
{
  async select(
    items: RecommendationItem[],
    limit: number,
  ): Promise<SelectorOutput> {
    const sortedUniqueItems = [
      ...new Map(
        [...items]
          .sort(
            (left, right) =>
              right.score - left.score ||
              left.content.title.localeCompare(
                right.content.title,
                "ko",
              ) ||
              left.content.id.localeCompare(right.content.id),
          )
          .map((item) => [item.content.id, item] as const),
      ).values(),
    ];

    return {
      selectedIds: sortedUniqueItems
        .slice(0, normalizeLimit(limit))
        .map(({ content }) => content.id),
      tokenUsage: 0,
    };
  }
}
