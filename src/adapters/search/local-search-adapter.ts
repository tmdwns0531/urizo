import type { CatalogContent } from "../../contracts/catalog";
import type { SearchAdapter } from "../../contracts/ports";
import type { SearchInput, SearchResult } from "../../contracts/search";
import { SEARCH_LIMIT } from "../../config/recommendation";
import { buildSearchQuery } from "../../domains/search/query";
import { semanticSimilarity } from "../../domains/search/semantic";

export class LocalSearchAdapter implements SearchAdapter {
  async search(
    input: SearchInput,
    candidates: CatalogContent[],
  ): Promise<SearchResult[]> {
    const query = buildSearchQuery(input);
    return candidates
      .map((content): SearchResult => {
        const similarity = semanticSimilarity(query, content);
        return {
          content,
          semanticScore: similarity.score,
          matchedTerms: similarity.matchedTerms,
        };
      })
      .sort(
        (left, right) =>
          right.semanticScore - left.semanticScore ||
          left.content.title.localeCompare(right.content.title, "ko"),
      )
      .slice(0, SEARCH_LIMIT);
  }
}
