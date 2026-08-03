import type { MvpClarificationAnswer } from "../../contracts/mvp-recommendation";
import type { OttProvider } from "../../contracts/catalog";
import {
  NATURAL_LANGUAGE_MAX_CODE_POINTS,
  type ChoiceRuntimeMinutes,
  type MediaTypePreference,
  type Mood,
  type MvpRecommendationRequest,
  type OriginPreference,
} from "../../contracts/mvp-search";
import {
  hasNaturalChildSignal,
  hasNaturalFamilySignal,
  parseNaturalInput,
  type ParsedNaturalConditionSource,
} from "../../domains/recommendation/natural-language/parse-natural-input";
import {
  buildRecommendationRequest,
  genreChoiceToApiGenres,
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

export type NaturalConditionSource =
  | ParsedNaturalConditionSource
  | "USER_EDITED"
  | "CLARIFIED";

export type NaturalConditionTag = {
  dimension: NaturalConditionDimension;
  label: string;
  source: NaturalConditionSource;
};

export type NaturalConditionDimension =
  | "동반자"
  | "작품 유형"
  | "시간"
  | "OTT"
  | "느낌"
  | "제작 지역"
  | "장르";

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
  runtimeMinutes: number | null;
  moods: Mood[];
  desiredGenres: string[];
  requiredGenres: string[];
  excludedGenres: string[];
  mediaType: MediaTypePreference;
  mediaTypeSource: NaturalConditionSource;
  tags: NaturalConditionTag[];
  steps: NaturalInterpretationStep[];
};

export type NaturalInterpretationOverrides = {
  who?: WhoChoice;
  mediaType?: MediaTypePreference;
  runtimeMinutes?: ChoiceRuntimeMinutes;
  providers?: OttProvider[];
  mood?: MoodChoice;
  origin?: OriginPreference;
  genres?: GenreChoice[];
};

export type NaturalInterpretationOverrideChange =
  | { dimension: "who"; value: WhoChoice }
  | { dimension: "mediaType"; value: MediaTypePreference }
  | { dimension: "runtimeMinutes"; value: ChoiceRuntimeMinutes }
  | { dimension: "providers"; value: OttProvider[] }
  | { dimension: "mood"; value: MoodChoice }
  | { dimension: "origin"; value: OriginPreference }
  | { dimension: "genres"; value: GenreChoice[] };

const WHO_LABELS: Record<WhoChoice, string> = {
  ALONE: "혼자",
  PARTNER: "연인과",
  FRIENDS: "친구와",
  FAMILY: "가족과",
  ANY: "동반자 제한 없음",
};

function findLabel<T extends { readonly value: unknown; readonly label: string }>(
  options: readonly T[],
  value: unknown,
) {
  return options.find((option) => option.value === value)?.label;
}

function runtimeToChoiceDuration(
  minutes: number | null,
): ChoiceFormState["duration"] {
  if (minutes === 30 || minutes === 60 || minutes === 120 || minutes === 180) {
    return minutes;
  }
  return null;
}

function apiGenresToChoiceGenres(values: readonly string[]): GenreChoice[] {
  const choices: GenreChoice[] = [];
  for (const value of values) {
    const choice: GenreChoice | null =
      value === "SF" || value === "판타지"
        ? "SF/판타지"
        : value === "공포" || value === "스릴러"
          ? "공포/스릴러"
          : value === "액션" ||
              value === "로맨스" ||
              value === "코미디" ||
              value === "애니메이션"
            ? value
            : null;
    if (choice && !choices.includes(choice)) choices.push(choice);
  }
  return choices.slice(0, 2);
}

function sourceDescription(
  source: NaturalConditionSource,
  userDescription: string,
  defaultDescription: string,
) {
  return source === "DEFAULT" ? defaultDescription : userDescription;
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
  return hasNaturalFamilySignal(value);
}

export function hasExplicitChildKeyword(value: string) {
  return hasNaturalChildSignal(value);
}

export function clarificationAnswerToNaturalFamily(
  answer: MvpClarificationAnswer,
): NaturalFamilyClarification {
  if (answer === "ADULTS_ONLY") {
    return { familyType: "ADULTS", childAge: null };
  }
  if (answer === "CHILD_7") {
    return { familyType: "KIDS", childAge: "AGE_7" };
  }
  if (answer === "CHILD_12") {
    return { familyType: "KIDS", childAge: "AGE_12" };
  }
  if (answer === "CHILD_15") {
    return { familyType: "KIDS", childAge: "AGE_15" };
  }
  return { familyType: "KIDS", childAge: "PRESCHOOL" };
}

export function interpretNaturalRequest(
  input: string,
  clarification?: NaturalFamilyClarification,
  overrides: NaturalInterpretationOverrides = {},
): NaturalInterpretation {
  const text = input.trim();
  const parsed = parseNaturalInput(text);
  const parsedWho: WhoChoice =
    parsed.companion.value === "WITH_CHILDREN" ||
    parsed.companion.value === "FAMILY"
      ? "FAMILY"
      : parsed.companion.value;
  const who = overrides.who ?? parsedWho;
  const needsFamilyClarification =
    who === "FAMILY" &&
    (overrides.who !== undefined || hasNaturalFamilySignal(text));
  const familyType =
    who === "FAMILY" && needsFamilyClarification
      ? (clarification?.familyType ??
        (overrides.who === undefined && hasNaturalChildSignal(text)
          ? "KIDS"
          : null))
      : null;
  const childAge = familyType === "KIDS" ? clarification?.childAge ?? null : null;
  const whoSource: NaturalConditionSource =
    overrides.who !== undefined
      ? "USER_EDITED"
      : clarification
        ? "CLARIFIED"
        : parsed.companion.source;

  const otts =
    overrides.providers === undefined
      ? [...parsed.providers.value]
      : [...overrides.providers];
  const ottSource: NaturalConditionSource =
    overrides.providers === undefined
      ? parsed.providers.source
      : "USER_EDITED";
  const runtimeMinutes =
    overrides.runtimeMinutes === undefined
      ? parsed.runtimeMinutes.value
      : overrides.runtimeMinutes;
  const duration = runtimeToChoiceDuration(runtimeMinutes);
  const durationSource: NaturalConditionSource =
    overrides.runtimeMinutes === undefined
      ? parsed.runtimeMinutes.source
      : "USER_EDITED";
  const moods =
    overrides.mood === undefined
      ? [...parsed.moods.value]
      : overrides.mood === "ANY"
        ? []
        : [overrides.mood];
  const mood: MoodChoice = moods[0] ?? "ANY";
  const moodSource: NaturalConditionSource =
    overrides.mood === undefined ? parsed.moods.source : "USER_EDITED";
  const origin = overrides.origin ?? parsed.origin.value;
  const originSource: NaturalConditionSource =
    overrides.origin === undefined ? parsed.origin.source : "USER_EDITED";
  const desiredGenres =
    overrides.genres === undefined
      ? [...parsed.desiredGenres.value]
      : [
          ...new Set(
            overrides.genres.flatMap((genre) =>
              genreChoiceToApiGenres(genre),
            ),
          ),
        ];
  const requiredGenres =
    overrides.genres === undefined ? [...parsed.requiredGenres.value] : [];
  const excludedGenres =
    overrides.genres === undefined ? [...parsed.excludedGenres.value] : [];
  const genreSource: NaturalConditionSource =
    overrides.genres !== undefined
      ? "USER_EDITED"
      : parsed.desiredGenres.source === "EXPLICIT" ||
          parsed.requiredGenres.source === "EXPLICIT" ||
          parsed.excludedGenres.source === "EXPLICIT"
        ? "EXPLICIT"
        : "DEFAULT";
  const genres =
    overrides.genres === undefined
      ? apiGenresToChoiceGenres([...desiredGenres, ...requiredGenres])
      : [...overrides.genres];
  const mediaType = overrides.mediaType ?? parsed.mediaType.value;
  const mediaTypeSource: NaturalConditionSource =
    overrides.mediaType === undefined
      ? parsed.mediaType.source
      : "USER_EDITED";

  const draft: ChoiceFormState = {
    who,
    familyType,
    childAge,
    duration,
    otts,
    mood,
    origin,
    mediaType,
    genres,
  };

  const selectedAgeLabel = findLabel(CHILD_AGE_OPTIONS, childAge);
  const whoLabel =
    who === "FAMILY" && familyType === "ADULTS"
      ? "성인 가족과"
      : who === "FAMILY" && familyType === "KIDS"
        ? `아이와 함께 · 최대 허용 ${selectedAgeLabel ?? "관람등급 확인 필요"}`
        : WHO_LABELS[who];
  const durationLabel =
    runtimeMinutes !== null
      ? `${runtimeMinutes}분 이내`
      : findLabel(DURATION_OPTIONS, duration) ?? "시간 제한 없음";
  const ottLabel =
    ottSource === "DEFAULT" || otts.length === OTT_OPTIONS.length
      ? "모든 지원 OTT"
      : otts
          .map((provider) => findLabel(OTT_OPTIONS, provider) ?? provider)
          .join(", ");
  const moodLabel = moods.length
    ? moods
        .map((value) => findLabel(MOOD_OPTIONS, value) ?? value)
        .join(", ")
    : "느낌 제한 없음";
  const originLabel = findLabel(ORIGIN_OPTIONS, origin) ?? "제작 지역 제한 없음";
  const genreParts = [
    desiredGenres.length ? desiredGenres.join(", ") : null,
    requiredGenres.length ? `${requiredGenres.join(", ")}만` : null,
    excludedGenres.length ? `${excludedGenres.join(", ")} 제외` : null,
  ].filter((value): value is string => value !== null);
  const genreLabel = genreParts.length
    ? genreParts.join(" · ")
    : "장르 제한 없음";
  const mediaTypeLabel =
    mediaType === "MOVIE"
      ? "영화"
      : mediaType === "SERIES"
        ? "시리즈"
        : "영화·시리즈 모두";

  const tags: NaturalConditionTag[] = [
    { dimension: "동반자", label: whoLabel, source: whoSource },
    {
      dimension: "작품 유형",
      label: mediaTypeLabel,
      source: mediaTypeSource,
    },
    { dimension: "시간", label: durationLabel, source: durationSource },
    { dimension: "OTT", label: ottLabel, source: ottSource },
    { dimension: "느낌", label: moodLabel, source: moodSource },
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
      title: "작품 유형",
      source: mediaTypeSource,
      description: sourceDescription(
        mediaTypeSource,
        mediaType === "ANY"
          ? "영화와 시리즈를 모두 비교했어요."
          : `${mediaTypeLabel}만 비교했어요.`,
        "작품 유형 표현이 없어 영화와 시리즈를 모두 비교했어요.",
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
      source: moodSource !== "DEFAULT" ? moodSource : genreSource,
      description:
        moodSource !== "DEFAULT" || genreSource !== "DEFAULT"
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
    steps.push({
      title: "아이 동반 안전 기준",
      source: clarification ? "CLARIFIED" : "DISCLOSURE",
      description: selectedAgeLabel
        ? `${selectedAgeLabel}를 최대 허용 관람등급으로 결과 필터에 적용했어요. 정확한 나이는 저장하지 않아요.`
        : "검색 전에 최대 허용 관람등급을 확인하고, 아이의 정확한 나이는 저장하지 않아요.",
    });
  }

  return {
    draft,
    runtimeMinutes,
    moods,
    desiredGenres,
    requiredGenres,
    excludedGenres,
    mediaType,
    mediaTypeSource,
    tags,
    steps,
  };
}

export function buildNaturalRecommendationRequest(
  input: string,
  interpretation: NaturalInterpretation,
): MvpRecommendationRequest {
  const structured = buildRecommendationRequest(interpretation.draft);
  return {
    choice: {
      ...structured.choice,
      moods: [...interpretation.moods],
      desiredGenres: [...interpretation.desiredGenres],
      explicitlyRequestedGenres: [...interpretation.desiredGenres],
      requiredGenres: [...interpretation.requiredGenres],
      excludedGenres: [...interpretation.excludedGenres],
      mediaType: interpretation.mediaType,
      naturalRuntimeMinutes: interpretation.runtimeMinutes,
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
    mediaType: draft.mediaType,
    genres: [...draft.genres],
  };
}
