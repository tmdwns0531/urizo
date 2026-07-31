import type { TransientRecommendationSearchInput } from "../../contracts/mvp-search";
import type { SearchInput } from "../../contracts/search";

const MOOD_COPY: Record<string, string> = {
  밝은: "즐겁고 가볍게 웃을 수 있는 밝은 작품",
  따뜻한: "위로받고 싶은 따뜻한 작품",
  감성적인: "감성에 젖을 수 있는 작품",
  어두운: "어둡고 진한 작품",
  "긴장감 있는": "긴장감을 느끼고 싶은 작품",
  잔잔한: "편안하게 쉬며 볼 수 있는 잔잔한 작품",
  "생각할 거리가 있는": "생각할 거리가 있는 작품",
  자극적인: "강렬하고 자극적인 작품",
};

const COMPANION_COPY: Record<string, string> = {
  ALONE: "혼자",
  PARTNER: "연인과",
  FRIENDS: "친구와",
  FAMILY: "가족과",
  WITH_CHILDREN: "아이와",
  ANY: "",
};

interface SearchQueryParts {
  companions: readonly string[];
  moods: readonly string[];
  desiredGenres: readonly string[];
  maxRuntimeMinutes: number | null;
  originPreference: "KR" | "NON_KR" | "ANY";
  naturalLanguage: string;
}

function buildStructuredSearchQuery(input: SearchQueryParts): string {
  const companion = input.companions
    .map((item) => COMPANION_COPY[item] ?? "")
    .filter(Boolean)
    .join(" 또는 ");
  const mood = input.moods
    .map((item) => MOOD_COPY[item] ?? `${item} 분위기의 작품`)
    .join(", ");
  const genres = input.desiredGenres.join(", ");
  const duration =
    input.maxRuntimeMinutes === null
      ? ""
      : `${input.maxRuntimeMinutes}분 안에 볼 수 있는`;
  const origin =
    input.originPreference === "KR"
      ? "한국 작품"
      : input.originPreference === "NON_KR"
        ? "해외 작품"
        : "";

  return [companion, duration, origin, mood, genres]
    .filter(Boolean)
    .join(" ")
    .trim();
}

/**
 * Initial search combines transient natural language with positive CHOICE
 * chips. Mandatory provider/runtime/origin policy remains structured and is
 * never inferred back out of this sentence.
 */
export function buildMvpSearchQuery(
  input: TransientRecommendationSearchInput,
): string {
  const naturalLanguage = input.naturalLanguage.trim();
  const structured = buildStructuredSearchQuery(input);
  return [naturalLanguage, structured]
    .filter(Boolean)
    .join(". ") || "지금 편하게 볼 수 있는 재미있는 작품";
}

/** @deprecated Use buildMvpSearchQuery for anonymous MVP code. */
export function buildSearchQuery(input: SearchInput): string {
  const naturalLanguage = input.naturalLanguage.trim();
  const structured = buildStructuredSearchQuery(input);
  return [naturalLanguage, structured]
    .filter(Boolean)
    .join(". ") || "지금 편하게 볼 수 있는 재미있는 작품";
}
