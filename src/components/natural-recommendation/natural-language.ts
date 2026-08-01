import type { OttProvider } from "../../contracts/catalog";
import { OTT_PROVIDERS } from "../../contracts/catalog";
import type { MvpRecommendationRequest } from "../../contracts/mvp-search";
import { NATURAL_LANGUAGE_MAX_CODE_POINTS } from "../../contracts/mvp-search";
import {
  buildRecommendationRequest,
  type ChoiceDraftPayload,
} from "../choice-stepper/choice-state";
import {
  CHILD_AGE_OPTIONS,
  DURATION_OPTIONS,
  MOOD_OPTIONS,
  ORIGIN_OPTIONS,
  OTT_OPTIONS,
} from "../choice-stepper/choice-options";
import type {
  ChildAge,
  ChoiceFormState,
  FamilyType,
  GenreChoice,
  MoodChoice,
  WhoChoice,
} from "../choice-stepper/choice-types";

export type NaturalConditionSource = "USER" | "DEFAULT";

export type NaturalConditionTag = {
  dimension: string;
  label: string;
  source: NaturalConditionSource;
};

export type NaturalInterpretationStep = {
  title: string;
  description: string;
  source: NaturalConditionSource | "DISCLOSURE";
};

export type NaturalFamilyClarification = {
  familyType: FamilyType;
  childAge: ChildAge | null;
};

export type NaturalInterpretation = {
  draft: ChoiceFormState;
  tags: NaturalConditionTag[];
  steps: NaturalInterpretationStep[];
};

type PatternChoice<T> = {
  value: T;
  pattern: RegExp;
};

const FAMILY_PATTERN = /(가족|아이|자녀|아기|어린이|초등학생|청소년)/;
const EXPLICIT_CHILD_PATTERN = /(아이|자녀|아기|어린이|초등학생|청소년)/;

const COMPANION_PATTERNS: ReadonlyArray<PatternChoice<WhoChoice>> = [
  { value: "ALONE", pattern: /(혼자|나홀로|나 홀로|혼영)/ },
  {
    value: "PARTNER",
    pattern: /(연인|커플|남자친구|여자친구|남친|여친|남편|아내|배우자)/,
  },
  { value: "FRIENDS", pattern: /(친구|동료|모임)/ },
];

const PROVIDER_PATTERNS: ReadonlyArray<{
  value: OttProvider;
  pattern: RegExp;
}> = [
  { value: "NETFLIX", pattern: /(넷플릭스|넷플)/ },
  { value: "TVING", pattern: /(티빙|tving)/i },
  { value: "DISNEY_PLUS", pattern: /(디즈니\s*\+?|디즈니플러스|디플)/i },
  { value: "WAVVE", pattern: /(웨이브|wavve)/i },
  { value: "WATCHA", pattern: /(왓챠|watcha)/i },
  { value: "COUPANG_PLAY", pattern: /(쿠팡\s*플레이|쿠플|coupang\s*play)/i },
];

const MOOD_PATTERNS: ReadonlyArray<PatternChoice<Exclude<MoodChoice, "ANY">>> = [
  { value: "밝은", pattern: /(웃|유쾌|밝은|밝고|가볍게|코믹)/ },
  { value: "따뜻한", pattern: /(위로|힐링|따뜻|포근|편안)/ },
  { value: "감성적인", pattern: /(감성|눈물|슬픈|먹먹|로맨틱)/ },
  {
    value: "긴장감 있는",
    pattern: /(긴장|쫄깃|스릴|서스펜스|반전|무서운)/,
  },
  {
    value: "생각할 거리가 있는",
    pattern: /(생각할|생각이|여운|철학|메시지|의미 있는)/,
  },
  { value: "자극적인", pattern: /(자극|강렬|속도감|화끈)/ },
];

const GENRE_PATTERNS: ReadonlyArray<PatternChoice<GenreChoice>> = [
  { value: "액션", pattern: /(액션|전투|추격|히어로)/ },
  { value: "로맨스", pattern: /(로맨스|멜로|연애|로맨틱)/ },
  { value: "코미디", pattern: /(코미디|코믹|웃긴)/ },
  { value: "애니메이션", pattern: /(애니메이션|애니|만화 영화)/ },
  { value: "SF/판타지", pattern: /(sf|에스에프|판타지|우주|마법)/i },
  { value: "공포/스릴러", pattern: /(공포|호러|스릴러|미스터리|추리)/ },
];

const WHO_LABELS: Record<WhoChoice, string> = {
  ALONE: "혼자",
  PARTNER: "연인과",
  FRIENDS: "친구와",
  FAMILY: "가족과",
  ANY: "동반자 제한 없음",
};

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

function findLabel<T extends { readonly value: unknown; readonly label: string }>(
  options: readonly T[],
  value: unknown,
) {
  return options.find((option) => option.value === value)?.label;
}

function parseDuration(text: string): ChoiceFormState["duration"] {
  if (/(30\s*분|반\s*시간)/.test(text)) return 30;
  if (/(60\s*분|1\s*시간|한\s*시간)/.test(text)) return 60;
  if (/(120\s*분|2\s*시간|두\s*시간)/.test(text)) return 120;
  if (/(180\s*분|3\s*시간|세\s*시간)/.test(text)) return 180;
  return null;
}

function parseOrigin(text: string): ChoiceFormState["origin"] {
  const hasKorean = /(한국|국내|우리나라)/.test(text);
  const hasForeign = /(해외|외국|미국|영국|일본|유럽)/.test(text);
  if (hasKorean === hasForeign) return "ANY";
  return hasKorean ? "KR" : "NON_KR";
}

function sourceDescription(
  source: NaturalConditionSource,
  userDescription: string,
  defaultDescription: string,
) {
  return source === "USER" ? userDescription : defaultDescription;
}

export function countNaturalLanguageCodePoints(value: string) {
  return Array.from(value).length;
}

export function clampNaturalLanguage(value: string) {
  return Array.from(value)
    .slice(0, NATURAL_LANGUAGE_MAX_CODE_POINTS)
    .join("");
}

export function requiresAgeClarification(value: string) {
  return FAMILY_PATTERN.test(value);
}

export function hasExplicitChildKeyword(value: string) {
  return EXPLICIT_CHILD_PATTERN.test(value);
}

export function interpretNaturalRequest(
  input: string,
  clarification?: NaturalFamilyClarification,
): NaturalInterpretation {
  const text = input.trim();
  const needsFamilyClarification = requiresAgeClarification(text);
  if (needsFamilyClarification && !clarification) {
    throw new Error("가족 구성 확인이 필요합니다.");
  }
  if (
    clarification?.familyType === "KIDS" &&
    clarification.childAge === null
  ) {
    throw new Error("아이의 관람 등급 확인이 필요합니다.");
  }

  const parsedWho = findFirstPattern(text, COMPANION_PATTERNS);
  const familyType = needsFamilyClarification
    ? (clarification?.familyType ?? null)
    : null;
  const childAge = familyType === "KIDS" ? clarification?.childAge ?? null : null;
  const who: WhoChoice = needsFamilyClarification
    ? "FAMILY"
    : (parsedWho ?? "ANY");
  const whoSource: NaturalConditionSource =
    needsFamilyClarification || parsedWho ? "USER" : "DEFAULT";

  const selectedProviders = PROVIDER_PATTERNS.filter(({ pattern }) =>
    pattern.test(text),
  ).map(({ value }) => value);
  const explicitlyAnyProvider = /(ott|오티티|플랫폼).*(상관없|아무거나|제한 없)/i.test(
    text,
  );
  const otts = selectedProviders.length
    ? [...new Set(selectedProviders)]
    : [...OTT_PROVIDERS];
  const ottSource: NaturalConditionSource =
    selectedProviders.length || explicitlyAnyProvider
    ? "USER"
    : "DEFAULT";

  const duration = parseDuration(text);
  const explicitlyAnyDuration = /(시간|러닝타임).*(상관없|제한 없|아무거나)/.test(
    text,
  );
  const durationSource: NaturalConditionSource =
    duration === null && !explicitlyAnyDuration ? "DEFAULT" : "USER";
  const parsedMood = findFirstPattern(text, MOOD_PATTERNS);
  const mood: MoodChoice = parsedMood ?? "ANY";
  const explicitlyAnyMood = /(느낌|분위기|기분).*(상관없|아무거나|제한 없)/.test(
    text,
  );
  const moodSource: NaturalConditionSource = parsedMood ? "USER" : "DEFAULT";
  const origin = parseOrigin(text);
  const originSource: NaturalConditionSource =
    origin === "ANY" ? "DEFAULT" : "USER";
  const genres = GENRE_PATTERNS.filter(({ pattern }) => pattern.test(text))
    .map(({ value }) => value)
    .slice(0, 2);
  const genreSource: NaturalConditionSource = genres.length
    ? "USER"
    : "DEFAULT";

  const resolvedMoodSource: NaturalConditionSource = explicitlyAnyMood
    ? "USER"
    : moodSource;

  const draft: ChoiceFormState = {
    who,
    familyType,
    childAge,
    duration,
    otts,
    mood,
    origin,
    genres,
  };

  const whoLabel =
    who === "FAMILY" && familyType === "ADULTS"
      ? "성인 가족과"
      : who === "FAMILY" && familyType === "KIDS"
        ? "아이와 함께 · 공통 안전 기준"
        : WHO_LABELS[who];
  const durationLabel =
    findLabel(DURATION_OPTIONS, duration) ?? "시간 제한 없음";
  const ottLabel =
    ottSource === "DEFAULT"
      ? "모든 지원 OTT"
      : otts
          .map((provider) => findLabel(OTT_OPTIONS, provider) ?? provider)
          .join(", ");
  const moodLabel = findLabel(MOOD_OPTIONS, mood) ?? "느낌 제한 없음";
  const originLabel = findLabel(ORIGIN_OPTIONS, origin) ?? "제작 지역 제한 없음";
  const genreLabel = genres.length ? genres.join(", ") : "장르 제한 없음";

  const tags: NaturalConditionTag[] = [
    { dimension: "동반자", label: whoLabel, source: whoSource },
    { dimension: "시간", label: durationLabel, source: durationSource },
    { dimension: "OTT", label: ottLabel, source: ottSource },
    { dimension: "느낌", label: moodLabel, source: resolvedMoodSource },
    { dimension: "제작 지역", label: originLabel, source: originSource },
    { dimension: "장르", label: genreLabel, source: genreSource },
  ];

  const steps: NaturalInterpretationStep[] = [
    {
      title: "함께 보는 사람",
      source: whoSource,
      description: sourceDescription(
        whoSource,
        `${whoLabel} 보는 조건을 적용했어요.`,
        "동반자 표현이 없어 누구와 보든 괜찮은 조건으로 채웠어요.",
      ),
    },
    {
      title: "볼 수 있는 시간",
      source: durationSource,
      description: sourceDescription(
        durationSource,
        `${durationLabel} 작품만 비교했어요.`,
        "시간 표현이 없어 러닝타임을 제한하지 않았어요.",
      ),
    },
    {
      title: "이용할 OTT",
      source: ottSource,
      description: sourceDescription(
        ottSource,
        `${ottLabel}에서 볼 수 있는 작품만 남겼어요.`,
        "OTT 표현이 없어 현재 지원하는 모든 OTT를 비교했어요.",
      ),
    },
    {
      title: "느낌과 취향",
      source:
        resolvedMoodSource === "USER" || genreSource === "USER"
          ? "USER"
          : "DEFAULT",
      description:
        resolvedMoodSource === "USER" || genreSource === "USER"
          ? `${moodLabel}${genres.length ? ` · ${genreLabel}` : ""}에 가까운 작품을 우선했어요.`
          : "느낌과 장르 표현이 없어 다른 조건을 우선했어요.",
    },
    {
      title: "제작 지역",
      source: originSource,
      description: sourceDescription(
        originSource,
        `${originLabel} 조건을 적용했어요.`,
        "지역 표현이 없거나 서로 충돌해 제작 지역을 제한하지 않았어요.",
      ),
    },
  ];

  if (familyType === "KIDS") {
    const selectedAgeLabel = findLabel(CHILD_AGE_OPTIONS, childAge);
    steps.push({
      title: "아이 동반 안전 기준",
      source: "DISCLOSURE",
      description: `${selectedAgeLabel ?? "선택한 등급"}은 Choice 화면에 이어서 보여드려요. 현재 추천 엔진에는 정확한 연령 필드가 없어 전체·7세·12세 공통 기준을 더 안전하게 적용했어요.`,
    });
  }

  if (/(영화|드라마|시리즈|예능)/.test(text)) {
    steps.push({
      title: "작품 유형 표현",
      source: "DISCLOSURE",
      description:
        "작품 유형은 현재 고정 필터가 아니라 문장 의미를 비교하는 데 참고했어요.",
    });
  }

  return { draft, tags, steps };
}

export function buildNaturalRecommendationRequest(
  input: string,
  interpretation: NaturalInterpretation,
): MvpRecommendationRequest {
  const structured = buildRecommendationRequest(interpretation.draft);
  return {
    choice: {
      ...structured.choice,
      naturalLanguage: input.trim(),
    },
  };
}

export function toChoiceHandoffDraft(
  interpretation: NaturalInterpretation,
): ChoiceDraftPayload {
  const { draft } = interpretation;
  return {
    who: draft.who,
    familyType: draft.familyType,
    childAge: draft.childAge,
    duration: draft.duration,
    otts: [...draft.otts],
    mood: draft.mood,
    origin: draft.origin,
    genres: [...draft.genres],
  };
}
