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
 * 분위기 판정 낱말을 톤과 소재로 나눈다.
 *
 * 소재만으로 분위기를 정하면 오탐이 난다 — 어벤져스는 friendship+teamwork 로
 * `따뜻한`, 토이 스토리는 villain+bullying 로 `어두운`, 주토피아 2 는
 * cop+미스터리 장르로 `긴장감 있는` 이 됐다. 그래서 톤 낱말을 최소 하나 요구한다.
 *
 * 다만 무엇을 톤으로 볼지는 분위기마다 다르다. 화면 문구가 그 분위기를 어떻게
 * 정의하는지에 맞춘다:
 *
 *   "액션과 빠른 전개"        → action·superhero 가 곧 그 느낌이다 (톤)
 *   "유쾌한 분위기"           → comedy 가 곧 그 느낌이다 (톤)
 *   "감정선, 음악, 관계 중심"  → romance·music 이 곧 그 느낌이다 (톤)
 *   "공감과 회복"            → friendship 은 관계일 뿐이다 (소재)
 *
 * 정확일치만 인정한다. 부분일치는 "dark comedy" 가 "comedy" 에 걸려 어두운
 * 작품을 밝은으로 만든다.
 */
const MOOD_TONE_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  // "가볍게 웃을 수 있는 · 유쾌한 분위기, 부담 없는 전개"
  밝은: [
    "cheerful", "amused", "enthusiastic", "charming", "feel-good", "feel good",
    "humor", "witty", "comedy", "sitcom", "romcom", "buddy comedy", "slapstick",
    "parody",
  ],
  // "따뜻하게 위로받는 · 공감과 회복" — 감정으로만 판정한다.
  //
  // adoring·admiring 은 뺐다. "감탄하게 되는" 이라는 관객 반응이지 작품이
  // 따뜻하다는 뜻이 아니라, 분노의 질주·인셉션·핵소 고지에도 붙어 있다.
  // 이 둘 때문에 웬즈데이(고딕 미스터리)와 주술회전(다크 배틀물)이
  // `따뜻하게 위로받는` 상위에 올라왔다. 빼도 하울의 움직이는 성·와일드
  // 로봇·빨간 머리 앤·응답하라 1988·우영우는 그대로 남는다.
  따뜻한: [
    "heartfelt", "heartwarming", "comforting", "inspirational", "hopeful",
    "kindness", "healing",
  ],
  // "감정선이 풍부한 · 감정선, 음악, 관계 중심"
  감성적인: [
    "tearjerker", "bittersweet", "melancholy", "wistful", "nostalgic",
    "nostalgia", "melodramatic", "longing", "dramatic", "romance", "love",
    "first love", "forbidden love", "soulmates", "music", "musician",
    "musical", "jazz",
  ],
  어두운: [
    "depressing", "nihilism", "dark comedy", "black comedy", "psychological",
    "obsession",
  ],
  // "심장이 쫄깃해지는 · 긴장감과 서스펜스"
  "긴장감 있는": [
    "suspense", "suspenseful", "thriller", "psychological thriller", "tense",
    "crime thriller", "horror", "supernatural horror", "teen horror", "slasher",
  ],
  잔잔한: ["quiet", "contemplative", "calm", "relaxing", "gentle"],
  // "여운이 길게 남는 · 메시지나 결말을 오래 생각하게 하는 작품"
  "생각할 거리가 있는": [
    "philosophy", "social commentary", "satire", "social satire", "allegory",
    "existentialism", "moral dilemma", "thought provoking", "redemption",
    "hope", "freedom", "sacrifice",
  ],
  // "강렬하고 속도감 있는 · 액션과 빠른 전개"
  //
  // disaster 는 넣고 disaster movie 는 뺐다. 타이타닉이 disaster movie 만
  // 갖고 있어서, 넣으면 로맨스 드라마가 액션 칩으로 들어온다. disaster 쪽은
  // 2012·샌 안드레아스·지오스톰·포세이돈처럼 실제로 액션 장르인 재난물만
  // 걸린다 — 돈 룩 업·체르노빌은 액션 장르가 아니라 통과하지 못한다.
  자극적인: [
    "aggressive", "bold", "intense", "action", "superhero", "martial arts",
    "war", "battle", "fight", "chase", "car chase", "explosion", "gunfight",
    "shootout", "spy", "heist", "disaster",
  ],
};

/** 소재 낱말. 톤 낱말이 이미 있을 때 근거를 보태는 역할만 한다. */
const MOOD_SUBJECT_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  밝은: [],
  따뜻한: [
    "friendship", "family", "family relationships", "chosen family", "teamwork",
    "sibling relationship", "father daughter relationship",
    "mother son relationship",
  ],
  // loss of loved one 은 뺐다. "사랑하는 사람을 잃음" 은 줄거리 사건이지
  // 감정선이 아니다 — 식스 센스(유령물)와 포세이돈(재난물)이 dramatic 과
  // 짝을 이뤄 `감정선이 풍부한` 에 들어와 있었다. 포레스트 검프·뷰티풀
  // 마인드는 로맨스 장르로 통과하므로 그대로 남는다.
  감성적인: ["coming of age"],
  어두운: [
    "revenge", "murder", "murderer", "criminal", "corruption", "violence",
    "crime", "drugs", "dysfunctional family", "dystopia",
  ],
  "긴장감 있는": [
    "mystery", "murder mystery", "detective", "investigation",
    "criminal investigation", "crime investigation", "police procedural",
    "criminal consultant", "special agent", "survival", "conspiracy", "police",
    "cop", "fbi", "lapd",
  ],
  잔잔한: [
    "slice of life", "everyday life", "countryside", "rural", "small town",
    "cooking", "food", "korean cuisine", "medical drama", "hospital",
  ],
  "생각할 거리가 있는": [
    "class differences", "capitalism", "identity", "society",
    "based on novel or book", "dystopia", "time travel", "life after death",
  ],
  자극적인: [],
};

/**
 * 장르는 보조 근거다. 톤 낱말이 이미 있을 때만 두 번째 근거를 대신할 수 있고,
 * 장르만으로는 절대 태그를 붙이지 않는다 — 그러면 같은 장르가 통째로 같은
 * 분위기를 받아, 분위기를 고르는 것이 장르를 고르는 것과 같아진다.
 */
const MOOD_GENRES: Readonly<Record<string, readonly string[]>> = {
  밝은: ["코미디"],
  따뜻한: ["가족", "애니메이션", "Kids"],
  감성적인: ["로맨스", "음악"],
  어두운: ["공포"],
  "긴장감 있는": ["범죄", "스릴러", "미스터리"],
  잔잔한: ["다큐멘터리"],
  "생각할 거리가 있는": [],
  자극적인: ["액션", "모험", "전쟁", "Action & Adventure"],
};

/**
 * TMDB keyword 는 작품 전체의 톤이 아니라 장면·요소 단위 태그다.
 * '반지의 제왕: 왕의 귀환' 에는 madness, obsession 과 함께 cheerful 이 붙어
 * 있다. 근거 하나로 확정하면 이런 우연한 태그가 만점을 받는다.
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

const countHits = (
  keywords: readonly string[],
  needles: readonly string[],
): number => keywords.filter((keyword) => needles.includes(keyword)).length;

/**
 * 채택 조건: 톤 낱말이 하나 이상 있고, 거기에 근거가 하나 더 있거나
 * 장르가 맞을 것.
 *
 *   톤 0개                    → 붙이지 않는다 (소재만으로는 톤을 못 정한다)
 *   톤 1개 + 소재/톤 1개 이상   → 채택
 *   톤 1개 + 장르 일치         → 채택
 *
 * 수집 코퍼스 1,270편(익명 가용)으로 검증했다. 확인한 오탐 11건이 모두
 * 걸러지면서 분위기 태그가 붙는 작품 비율은 22% → 40% 로 올랐다. 장르만으로
 * 붙이던 예전 방식은 태그의 64% 가 장르에서 나와 분위기가 곧 장르였다.
 */
export function deriveMoodTags(
  keywords: readonly string[],
  genres: readonly string[],
): string[] {
  return unique(
    Object.keys(MOOD_TONE_KEYWORDS).filter((mood) => {
      const tone = countHits(keywords, MOOD_TONE_KEYWORDS[mood] ?? []);
      if (tone === 0) {
        return false;
      }
      const subject = countHits(keywords, MOOD_SUBJECT_KEYWORDS[mood] ?? []);
      const genreMatched = (MOOD_GENRES[mood] ?? []).some((name) =>
        genres.includes(name),
      );
      return tone + subject >= MIN_KEYWORD_EVIDENCE || genreMatched;
    }),
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
