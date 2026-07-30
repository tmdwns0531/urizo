import type { CatalogContent } from "../../contracts/catalog";

const SEMANTIC_GROUPS: readonly (readonly string[])[] = [
  ["웃긴", "웃음", "코미디", "유쾌한", "재치있는", "가벼운", "즐거운"],
  ["따뜻한", "위로", "힐링", "편안한", "잔잔한", "다정한"],
  ["긴장", "긴장감", "스릴러", "미스터리", "추리", "몰입"],
  ["감성", "감성적인", "로맨스", "사랑", "낭만", "눈물"],
  ["가족", "아이", "어린이", "함께", "애니메이션"],
  ["액션", "모험", "속도감", "영웅", "히어로"],
  ["생각", "여운", "철학", "사회", "진한", "드라마"],
  ["어두운", "공포", "무서운", "강렬한", "자극적인"],
  ["음악", "노래", "재즈", "밴드"],
] as const;

const normalize = (text: string): string =>
  text
    .toLocaleLowerCase("ko-KR")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");

export function tokenize(text: string): string[] {
  const base = normalize(text)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
  const expanded = new Set(base);

  for (const term of base) {
    for (const group of SEMANTIC_GROUPS) {
      if (group.some((word) => term.includes(word) || word.includes(term))) {
        group.forEach((word) => expanded.add(word));
      }
    }
  }

  return [...expanded];
}

function hashTerm(term: string, dimensions: number): number {
  let hash = 2166136261;
  for (let index = 0; index < term.length; index += 1) {
    hash ^= term.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % dimensions;
}

function vectorize(tokens: readonly string[], dimensions = 64): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const token of tokens) {
    vector[hashTerm(token, dimensions)] += 1;
    for (let index = 0; index < token.length - 1; index += 1) {
      vector[hashTerm(token.slice(index, index + 2), dimensions)] += 0.35;
    }
  }
  return vector;
}

function cosine(left: readonly number[], right: readonly number[]): number {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export function contentDocument(content: CatalogContent): string {
  return [
    content.title,
    content.synopsis,
    content.genres.join(" "),
    content.moodTags.join(" "),
    content.companionTags.join(" "),
  ].join(" ");
}

export function semanticSimilarity(
  query: string,
  content: CatalogContent,
): { score: number; matchedTerms: string[] } {
  const queryTokens = tokenize(query);
  const documentTokens = tokenize(contentDocument(content));
  const documentSet = new Set(documentTokens);
  const matchedTerms = queryTokens.filter((term) => documentSet.has(term));
  const overlap =
    queryTokens.length === 0 ? 0 : matchedTerms.length / queryTokens.length;
  const hashedCosine = cosine(
    vectorize(queryTokens),
    vectorize(documentTokens),
  );

  return {
    score: Math.max(0, Math.min(1, hashedCosine * 0.72 + overlap * 0.28)),
    matchedTerms: matchedTerms.slice(0, 6),
  };
}
