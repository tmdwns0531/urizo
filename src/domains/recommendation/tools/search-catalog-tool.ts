import type { CatalogContent } from "../../../contracts/catalog";
import type { RecommendationSearchAdapter } from "../../../contracts/mvp-ports";
import type {
  RecommendationSearchContinuation,
  RecommendationSearchInvocation,
  SanitizedRecommendationSearchInput,
} from "../../../contracts/mvp-search";
import type { CatalogRepository } from "../../../contracts/ports";
import type { RecommendationItem } from "../../../contracts/recommendation";
import { filterMvpCatalog } from "../../catalog/filtering";
import { scoreMvpSearchResults } from "../scoring";
import type { RegisteredTool } from "./tool-registry";

export const SEARCH_CATALOG_TOOL_NAME = "searchCatalog";

export interface SearchCatalogToolInput {
  invocation: RecommendationSearchInvocation;
}

export interface SearchCatalogToolOutput {
  ranked: RecommendationItem[];
  eligibleCatalog: CatalogContent[];
  excludedContentIds: string[];
  eligibleCount: number;
  searchInput: SanitizedRecommendationSearchInput;
  continuation: RecommendationSearchContinuation;
  modelCallCount: 0 | 1;
  tokenUsage: number;
}

const sanitizedInput = (
  invocation: RecommendationSearchInvocation,
): SanitizedRecommendationSearchInput => {
  const source = invocation.input;
  return {
    selectedProviders: [...source.selectedProviders],
    companions: [...source.companions],
    moods: [...source.moods],
    desiredGenres: [...source.desiredGenres],
    companionAvoidGenres: [...source.companionAvoidGenres],
    requiredGenres: [...(source.requiredGenres ?? [])],
    excludedGenres: [...(source.excludedGenres ?? [])],
    mediaType: source.mediaType ?? "ANY",
    maxRuntimeMinutes: source.maxRuntimeMinutes,
    childAgeRatingLimit: source.childAgeRatingLimit ?? null,
    originPreference: source.originPreference,
    hasNaturalLanguage: source.hasNaturalLanguage,
  };
};

export function createSearchCatalogTool(
  catalog: CatalogRepository,
  search: RecommendationSearchAdapter,
): RegisteredTool<SearchCatalogToolInput, SearchCatalogToolOutput> {
  return {
    name: SEARCH_CATALOG_TOOL_NAME,
    description:
      "저장된 카탈로그에서 필수 조건을 검사하고 검색·점수 계산한 허용 후보를 반환합니다.",
    async execute({ invocation }, signal) {
      const searchInput = sanitizedInput(invocation);
      const contents = await catalog.list();
      const filtered = filterMvpCatalog(contents, searchInput);
      const searchOutput = await search.search(
        invocation,
        filtered.eligible,
        signal,
      );
      const eligibleById = new Map(
        filtered.eligible.map((content) => [content.id, content]),
      );
      const allowedSearchResults = searchOutput.results.flatMap((result) => {
        const canonicalContent = eligibleById.get(result.content.id);
        return canonicalContent && Number.isFinite(result.semanticScore)
          ? [{ content: canonicalContent, semanticScore: result.semanticScore }]
          : [];
      });
      const ranked = [
        ...new Map(
          scoreMvpSearchResults(allowedSearchResults, searchInput).map(
            (item) => [item.content.id, item],
          ),
        ).values(),
      ];

      return {
        ranked,
        eligibleCatalog: [...filtered.eligible],
        excludedContentIds: filtered.excluded.map(({ content }) => content.id),
        eligibleCount: filtered.eligible.length,
        searchInput,
        continuation: searchOutput.continuation,
        modelCallCount: searchOutput.modelCallCount,
        tokenUsage: searchOutput.tokenUsage,
      };
    },
  };
}
