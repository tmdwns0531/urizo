import type { AgeRating } from "../../contracts/catalog";

/**
 * TMDB keyword·genre 에서 CHOICE 분위기·동반자 태그를 유도한다 (CAT-02).
 *
 * TMDB 는 분위기 항목 자체를 제공하지 않는다. 그래서 실제로 응답에 존재하는
 * keyword 와 genre 만 근거로 쓰고, 줄거리를 읽어 분위기를 추측하지 않는다.
 * OpenAI 도 호출하지 않는다. 같은 입력은 언제나 같은 태그를 만든다.
 *
 * 표는 수집 코퍼스 129편의 실제 keyword 빈도를 근거로 작성했다. TMDB 가
 * 제공하는 감정 키워드(cheerful, heartfelt, dramatic, depressing, nostalgic,
 * suspenseful, comforting, adoring, bold, enthusiastic 등)가 핵심 신호다.
 */

/**
 * 정확일치만 인정한다. 부분일치는 "dark comedy" 가 "comedy" 에 걸려
 * 어두운 작품을 밝은으로 분류하는 오탐을 만든다.
 */
const MOOD_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  밝은: [
    "cheerful", "amused", "enthusiastic", "charming", "feel-good", "feel good",
    "comedy", "sitcom", "romcom", "buddy comedy", "slapstick", "parody",
    "humor", "witty",
  ],
  따뜻한: [
    "heartfelt", "heartwarming", "comforting", "adoring", "admiring",
    "friendship", "family", "family relationships", "chosen family",
    "inspirational", "hopeful", "kindness", "healing", "teamwork",
    "sibling relationship", "father daughter relationship",
    "mother son relationship",
  ],
  감성적인: [
    "romance", "love", "first love", "nostalgia", "nostalgic", "melancholy",
    "melodramatic", "wistful", "dramatic", "tearjerker", "coming of age",
    "loss of loved one", "musician", "jazz", "music", "musical",
    "bittersweet", "longing",
  ],
  어두운: [
    "dark comedy", "black comedy", "dystopia", "depressing", "revenge",
    "murder", "murderer", "criminal", "villain", "anti hero", "nihilism",
    "tragedy", "corruption", "violence", "crime", "obsession", "drugs",
    "bullying", "dysfunctional family", "demon", "witch", "psychological",
    "dark fantasy",
  ],
  "긴장감 있는": [
    "suspense", "suspenseful", "thriller", "psychological thriller", "mystery",
    "murder mystery", "detective", "investigation", "criminal investigation",
    "crime investigation", "police procedural", "criminal consultant",
    "special agent", "survival", "conspiracy", "police", "cop", "fbi", "lapd",
    "crime thriller",
  ],
  잔잔한: [
    "slice of life", "everyday life", "countryside", "rural", "small town",
    "cooking", "food", "korean cuisine", "quiet", "contemplative",
    "medical drama", "hospital",
  ],
  "생각할 거리가 있는": [
    "philosophy", "social commentary", "social satire", "satire", "allegory",
    "class differences", "existentialism", "capitalism", "identity", "society",
    "based on novel or book", "dystopia", "time travel", "life after death",
    "moral dilemma",
  ],
  자극적인: [
    "action", "superhero", "martial arts", "war", "battle", "fight", "chase",
    "car chase", "explosion", "gunfight", "shootout", "spy", "heist",
    "aggressive", "bold",
  ],
};

/** keyword 가 하나도 안 걸릴 때만 쓰는 보조 근거. ko-KR·영문 장르명 모두 처리. */
const MOOD_GENRES: Readonly<Record<string, readonly string[]>> = {
  밝은: ["코미디"],
  따뜻한: ["가족", "애니메이션", "Kids"],
  감성적인: ["로맨스", "음악"],
  어두운: ["공포"],
  "긴장감 있는": ["범죄", "스릴러", "미스터리"],
  잔잔한: ["다큐멘터리"],
  자극적인: ["액션", "모험", "전쟁", "Action & Adventure"],
};

/**
 * TMDB keyword 는 작품 전체의 톤이 아니라 장면·요소 단위 태그다. 예를 들어
 * '반지의 제왕: 왕의 귀환'에는 madness, obsession 과 함께 cheerful 이 붙어
 * 있다. 근거 하나로 분위기를 확정하면 이런 우연한 태그가 만점을 받는다.
 * 그래서 같은 분위기를 가리키는 keyword 가 둘 이상일 때만 인정한다.
 */
export const MIN_KEYWORD_EVIDENCE = 2;

const unique = (values: readonly string[]): string[] => [...new Set(values)];

/** keyword 이름을 정규화한다. TMDB keyword 는 항상 영문 소문자 기준이다. */
export function normalizeKeywords(names: readonly string[]): string[] {
  return unique(
    names
      .map((name) => name.replace(/\s+/g, " ").trim().toLocaleLowerCase("en-US"))
      .filter(Boolean),
  );
}

export function deriveMoodTags(
  keywords: readonly string[],
  genres: readonly string[],
): string[] {
  const evidence = new Map<string, number>();
  for (const keyword of keywords) {
    for (const [mood, needles] of Object.entries(MOOD_KEYWORDS)) {
      if (needles.includes(keyword)) {
        evidence.set(mood, (evidence.get(mood) ?? 0) + 1);
      }
    }
  }

  const confident = [...evidence]
    .filter(([, count]) => count >= MIN_KEYWORD_EVIDENCE)
    .map(([mood]) => mood);
  if (confident.length > 0) {
    return confident;
  }

  return unique(
    Object.entries(MOOD_GENRES)
      .filter(([, names]) => names.some((name) => genres.includes(name)))
      .map(([mood]) => mood),
  );
}

/**
 * 동반자 태그. WITH_CHILDREN 은 keyword 가 아니라 연령 등급으로만 판단한다.
 * 안전 관련 판정이라 추측 근거를 쓰지 않는다. ALONE 은 항상 포함한다 —
 * 혼자 보는 것을 막을 근거가 없다.
 */
export function deriveCompanionTags(
  keywords: readonly string[],
  genres: readonly string[],
  ageRating: AgeRating,
): string[] {
  const tags = new Set<string>(["ALONE"]);
  const has = (...needles: readonly string[]): boolean =>
    needles.some(
      (needle) => keywords.includes(needle) || genres.includes(needle),
    );

  if (has("romance", "romcom", "love", "first love", "로맨스")) {
    tags.add("PARTNER");
  }
  if (has("friendship", "buddy comedy", "sitcom", "teamwork", "코미디", "액션")) {
    tags.add("FRIENDS");
  }
  if (
    has(
      "family", "family relationships", "chosen family", "sibling relationship",
      "가족", "애니메이션", "Kids",
    )
  ) {
    tags.add("FAMILY");
  }
  if (ageRating === "ALL" || ageRating === "7" || ageRating === "12") {
    tags.add("WITH_CHILDREN");
  }
  return [...tags];
}
