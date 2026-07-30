import type { SelectorAdapter } from "../../contracts/ports";
import type { RecommendationItem } from "../../contracts/recommendation";

export class DeterministicSelectorAdapter implements SelectorAdapter {
  select(items: RecommendationItem[], limit: number): RecommendationItem[] {
    return [...items]
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.content.title.localeCompare(right.content.title, "ko") ||
          left.content.id.localeCompare(right.content.id),
      )
      .slice(0, Math.max(0, limit));
  }
}
