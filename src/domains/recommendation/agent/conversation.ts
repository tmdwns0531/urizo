import type {
  MvpClarificationAnswer,
  MvpFamilyClarificationProposal,
} from "../../../contracts/mvp-recommendation";
import type {
  ChildAgeRatingLimit,
  TransientRecommendationSearchInput,
} from "../../../contracts/mvp-search";
import { hasNaturalAdultFamilySignal } from "../natural-language/parse-natural-input";

const FAMILY_AGE_ANSWERS = [
  { value: "ADULTS_ONLY", label: "성인만" },
  { value: "CHILD_ALL", label: "미취학 아동" },
  { value: "CHILD_7", label: "초등학생" },
  { value: "CHILD_12", label: "중학생" },
  { value: "CHILD_15", label: "고등학생 이상" },
] as const satisfies MvpFamilyClarificationProposal["answers"];

export function clarificationAnswerRatingLimit(
  answer: MvpClarificationAnswer,
): ChildAgeRatingLimit | null {
  if (answer === "WITH_CHILDREN" || answer === "CHILD_ALL") return "ALL";
  if (answer === "CHILD_7") return "7";
  if (answer === "CHILD_12") return "12";
  if (answer === "CHILD_15") return "15";
  return null;
}

/** The request resolver has already merged omitted natural-language fields. */
export function structureAgentInput(
  input: TransientRecommendationSearchInput,
): TransientRecommendationSearchInput {
  return {
    ...input,
    selectedProviders: [...input.selectedProviders],
    companions: [...input.companions],
    moods: [...input.moods],
    desiredGenres: [...input.desiredGenres],
    requiredGenres: [...(input.requiredGenres ?? [])],
    excludedGenres: [...(input.excludedGenres ?? [])],
    mediaType: input.mediaType ?? "ANY",
  };
}

export function createFamilyClarification(
  input: TransientRecommendationSearchInput,
): MvpFamilyClarificationProposal | null {
  const text = input.naturalLanguage.trim();
  const withChildren = input.companions.includes("WITH_CHILDREN");
  const withFamily = input.companions.includes("FAMILY");
  const needsChildRating =
    withChildren && input.childAgeRatingLimit === null;
  const needsNaturalFamilyComposition =
    withFamily &&
    input.hasNaturalLanguage &&
    !hasNaturalAdultFamilySignal(text);

  if (!needsChildRating && !needsNaturalFamilyComposition) return null;

  return {
    kind: "FAMILY_COMPOSITION",
    question: "함께 보는 가족 중 가장 어린 사람의 연령대를 알려주세요.",
    answers: [...FAMILY_AGE_ANSWERS],
  };
}

export function applyFamilyClarification(
  input: TransientRecommendationSearchInput,
  answer: MvpClarificationAnswer,
): TransientRecommendationSearchInput {
  const childAgeRatingLimit = clarificationAnswerRatingLimit(answer);
  return {
    ...input,
    companions: childAgeRatingLimit ? ["WITH_CHILDREN"] : ["FAMILY"],
    childAgeRatingLimit,
  };
}

export function askRuntimeRelaxation(
  candidateCount: number,
  currentMinutes: number,
  proposedMinutes: number,
): string {
  return `${currentMinutes}분 이내 조건을 지킨 후보가 ${candidateCount}편이에요. 러닝타임만 ${proposedMinutes}분까지 넓혀 다시 찾아볼까요?`;
}
