import {
  OTT_PROVIDERS,
  type OttProvider,
} from "../../../contracts/catalog";
import type {
  Companion,
  MediaTypePreference,
  Mood,
  OriginPreference,
} from "../../../contracts/mvp-search";

export type ParsedNaturalConditionSource = "EXPLICIT" | "DEFAULT";

export type ParsedNaturalCondition<T> = {
  value: T;
  source: ParsedNaturalConditionSource;
};

export type ParsedNaturalInput = {
  companion: ParsedNaturalCondition<Companion>;
  providers: ParsedNaturalCondition<OttProvider[]>;
  runtimeMinutes: ParsedNaturalCondition<number | null>;
  moods: ParsedNaturalCondition<Mood[]>;
  desiredGenres: ParsedNaturalCondition<string[]>;
  requiredGenres: ParsedNaturalCondition<string[]>;
  excludedGenres: ParsedNaturalCondition<string[]>;
  origin: ParsedNaturalCondition<OriginPreference>;
  mediaType: ParsedNaturalCondition<MediaTypePreference>;
};

type PatternChoice<T> = {
  value: T;
  pattern: RegExp;
};

const FAMILY_PATTERN = /(가족|아이|자녀|아기|어린이|초등학생|청소년)/;
const CHILD_PATTERN = /(아이|자녀|아기|어린이|초등학생|청소년)/;
const ADULT_FAMILY_PATTERN = /(성인\s*가족|어른|부모님)/;

const COMPANION_PATTERNS: ReadonlyArray<PatternChoice<Companion>> = [
  { value: "ALONE", pattern: /(혼자|나홀로|나 홀로|혼영)/ },
  {
    value: "PARTNER",
    pattern: /(연인|커플|남자친구|여자친구|남친|여친|남편|아내|배우자)/,
  },
  { value: "FRIENDS", pattern: /(친구|동료|모임)/ },
];

const PROVIDER_PATTERNS: ReadonlyArray<PatternChoice<OttProvider>> = [
  { value: "NETFLIX", pattern: /(넷플릭스|넷플)/ },
  { value: "TVING", pattern: /(티빙|tving)/i },
  { value: "DISNEY_PLUS", pattern: /(디즈니\s*\+?|디즈니플러스|디플)/i },
  { value: "WAVVE", pattern: /(웨이브|wavve)/i },
  { value: "WATCHA", pattern: /(왓챠|watcha)/i },
  {
    value: "COUPANG_PLAY",
    pattern: /(쿠팡\s*플레이|쿠플|coupang\s*play)/i,
  },
];

const MOOD_PATTERNS: ReadonlyArray<PatternChoice<Mood>> = [
  { value: "밝은", pattern: /(웃|유쾌|밝은|밝고|가볍게|코믹)/ },
  { value: "따뜻한", pattern: /(위로|힐링|따뜻|포근|편안)/ },
  { value: "감성적인", pattern: /(감성|눈물|슬픈|먹먹|로맨틱)/ },
  { value: "어두운", pattern: /(어두운|암울|무거운)/ },
  {
    value: "긴장감 있는",
    pattern: /(긴장|쫄깃|스릴|서스펜스|반전|무서운)/,
  },
  { value: "잔잔한", pattern: /(잔잔|차분|고요)/ },
  {
    value: "생각할 거리가 있는",
    pattern: /(생각할|생각이|여운|철학|메시지|의미 있는)/,
  },
  { value: "자극적인", pattern: /(자극|강렬|속도감|화끈)/ },
];

const GENRE_PATTERNS: ReadonlyArray<{
  values: readonly string[];
  pattern: RegExp;
}> = [
  { values: ["액션"], pattern: /(액션|전투|추격|히어로)/ },
  { values: ["로맨스"], pattern: /(로맨스|멜로|연애)/ },
  { values: ["코미디"], pattern: /(코미디|코믹|웃긴)/ },
  { values: ["애니메이션"], pattern: /(애니메이션|애니|만화 영화)/ },
  { values: ["SF", "판타지"], pattern: /(sf|에스에프|판타지|우주|마법)/i },
  {
    values: ["공포", "스릴러"],
    pattern: /(공포|호러|스릴러|미스터리|추리)/,
  },
];

const GENRE_EXCLUSION_PATTERN =
  /(제외|빼고|빼\s*줘|빼줘|말고|안\s*나오|싫어)/;
const GENRE_REQUIREMENT_PATTERN =
  /(만\s*(?:보여|추천|골라|찾아)?|로만|이어야|반드시|꼭)/;
const GENRE_PREFIX_REQUIREMENT_PATTERN = /(반드시|꼭)\s*$/;

const explicit = <T>(value: T): ParsedNaturalCondition<T> => ({
  value,
  source: "EXPLICIT",
});

const defaulted = <T>(value: T): ParsedNaturalCondition<T> => ({
  value,
  source: "DEFAULT",
});

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

function findFirstPattern<T>(
  text: string,
  choices: ReadonlyArray<PatternChoice<T>>,
): T | null {
  let selected: { value: T; index: number } | null = null;
  for (const choice of choices) {
    const index = text.search(choice.pattern);
    if (index >= 0 && (!selected || index < selected.index)) {
      selected = { value: choice.value, index };
    }
  }
  return selected?.value ?? null;
}

function parseCompanion(text: string): ParsedNaturalCondition<Companion> {
  if (CHILD_PATTERN.test(text)) return explicit("WITH_CHILDREN");
  if (/가족/.test(text)) return explicit("FAMILY");
  const companion = findFirstPattern(text, COMPANION_PATTERNS);
  if (companion) return explicit(companion);
  if (/(누구와|동반자|함께\s*보는\s*사람).*(상관없|아무나|제한\s*없)/.test(text)) {
    return explicit("ANY");
  }
  return defaulted("ANY");
}

function parseProviders(text: string): ParsedNaturalCondition<OttProvider[]> {
  const providers = unique(
    PROVIDER_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
      ({ value }) => value,
    ),
  );
  if (providers.length > 0) return explicit(providers);
  if (/(ott|오티티|플랫폼).*(상관없|아무거나|제한\s*없)/i.test(text)) {
    return explicit([...OTT_PROVIDERS]);
  }
  return defaulted([...OTT_PROVIDERS]);
}

function validRuntime(minutes: number): number | null {
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 180
    ? minutes
    : null;
}

function parseRuntime(text: string): ParsedNaturalCondition<number | null> {
  const hourMinuteMatch = text.match(
    /(?:1|한)\s*시간\s*(\d{1,2})\s*분/,
  );
  if (hourMinuteMatch) {
    const minutes = validRuntime(60 + Number(hourMinuteMatch[1]));
    if (minutes !== null) return explicit(minutes);
  }

  if (/(?:1|한)\s*시간\s*반/.test(text)) return explicit(90);

  const minuteMatch = text.match(/(\d{1,3})\s*분/);
  if (minuteMatch) {
    const minutes = validRuntime(Number(minuteMatch[1]));
    if (minutes !== null) return explicit(minutes);
  }

  if (/반\s*시간/.test(text)) return explicit(30);
  if (/(?:1|한)\s*시간/.test(text)) return explicit(60);
  if (/(?:2|두)\s*시간/.test(text)) return explicit(120);
  if (/(?:3|세)\s*시간/.test(text)) return explicit(180);
  if (/(시간|러닝타임).*(상관없|제한\s*없|아무거나)/.test(text)) {
    return explicit(null);
  }
  return defaulted(null);
}

type ParsedGenres = Pick<
  ParsedNaturalInput,
  "desiredGenres" | "requiredGenres" | "excludedGenres"
>;

function parseGenres(text: string): ParsedGenres {
  const desired: string[] = [];
  const required: string[] = [];
  const excluded: string[] = [];

  for (const [genreIndex, { values, pattern }] of GENRE_PATTERNS.entries()) {
    const match = text.match(pattern);
    if (!match || match.index === undefined) continue;
    const suffixStart = match.index + match[0].length;
    const remainingText = text.slice(suffixStart);
    const nextGenreOffset = GENRE_PATTERNS.reduce<number | null>(
      (nearest, candidate, candidateIndex) => {
        if (candidateIndex === genreIndex) return nearest;
        const offset = remainingText.search(candidate.pattern);
        if (offset < 0 || (nearest !== null && nearest <= offset)) {
          return nearest;
        }
        return offset;
      },
      null,
    );
    const suffix = remainingText.slice(
      0,
      Math.min(nextGenreOffset ?? 24, 24),
    );
    const prefix = text.slice(Math.max(0, match.index - 12), match.index);
    if (GENRE_EXCLUSION_PATTERN.test(suffix)) {
      excluded.push(...values);
    } else if (
      GENRE_REQUIREMENT_PATTERN.test(suffix) ||
      GENRE_PREFIX_REQUIREMENT_PATTERN.test(prefix)
    ) {
      required.push(...values);
    } else {
      desired.push(...values);
    }
  }

  const explicitlyAnyGenre =
    /(장르|종류).*(상관없|아무거나|제한\s*없)/.test(text);
  return {
    desiredGenres:
      desired.length > 0 || explicitlyAnyGenre
        ? explicit(unique(desired))
        : defaulted([]),
    requiredGenres:
      required.length > 0 ? explicit(unique(required)) : defaulted([]),
    excludedGenres:
      excluded.length > 0 ? explicit(unique(excluded)) : defaulted([]),
  };
}

function parseMoods(text: string): ParsedNaturalCondition<Mood[]> {
  const moods = unique(
    MOOD_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
      ({ value }) => value,
    ),
  );
  if (moods.length > 0) return explicit(moods);
  if (/(느낌|분위기|기분).*(상관없|아무거나|제한\s*없)/.test(text)) {
    return explicit([]);
  }
  return defaulted([]);
}

function parseOrigin(text: string): ParsedNaturalCondition<OriginPreference> {
  const hasKorean = /(한국|국내|우리나라)/.test(text);
  const hasForeign = /(해외|외국|미국|영국|일본|유럽)/.test(text);
  if (hasKorean !== hasForeign) return explicit(hasKorean ? "KR" : "NON_KR");
  if (
    hasKorean ||
    hasForeign ||
    /(제작\s*지역|국가|나라).*(상관없|아무거나|제한\s*없)/.test(text)
  ) {
    return explicit("ANY");
  }
  return defaulted("ANY");
}

function parseMediaType(
  text: string,
): ParsedNaturalCondition<MediaTypePreference> {
  const hasMovie = /(영화|무비)/.test(text);
  const hasSeries = /(시리즈|tv\s*쇼|티비\s*쇼)/i.test(text);
  if (hasMovie && hasSeries) return explicit("ANY");
  if (hasMovie) return explicit("MOVIE");
  if (hasSeries) return explicit("SERIES");
  if (/(작품|아무거나|상관없)/.test(text)) return explicit("ANY");
  return defaulted("ANY");
}

export function hasNaturalFamilySignal(text: string): boolean {
  return FAMILY_PATTERN.test(text);
}

export function hasNaturalChildSignal(text: string): boolean {
  return CHILD_PATTERN.test(text);
}

export function hasNaturalAdultFamilySignal(text: string): boolean {
  return ADULT_FAMILY_PATTERN.test(text);
}

/** Browser-safe deterministic extraction of explicit Korean input signals. */
export function parseNaturalInput(input: string): ParsedNaturalInput {
  const text = input.normalize("NFKC").trim();
  const genres = parseGenres(text);
  return {
    companion: parseCompanion(text),
    providers: parseProviders(text),
    runtimeMinutes: parseRuntime(text),
    moods: parseMoods(text),
    ...genres,
    origin: parseOrigin(text),
    mediaType: parseMediaType(text),
  };
}
