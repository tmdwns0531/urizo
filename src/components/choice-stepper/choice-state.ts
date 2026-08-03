import type { OttProvider } from "@/contracts/catalog";
import type {
  ChildAgeRatingLimit,
  MvpRecommendationRequest,
  OriginPreference,
} from "@/contracts/mvp-search";
import type {
  ChildAge,
  ChoiceFormState,
  ChoiceStep,
  FamilyType,
  GenreChoice,
  MoodChoice,
  WhoChoice,
} from "./choice-types";

export const INITIAL_CHOICE_STATE: ChoiceFormState = {
  who: null,
  familyType: null,
  childAge: null,
  duration: undefined,
  otts: [],
  mood: null,
  origin: null,
  genres: [],
};

export type ChoiceAction =
  | { type: "SET_WHO"; value: WhoChoice }
  | { type: "SET_FAMILY_TYPE"; value: FamilyType }
  | { type: "SET_CHILD_AGE"; value: ChildAge }
  | { type: "SET_DURATION"; value: NonNullable<ChoiceFormState["duration"]> | null }
  | { type: "TOGGLE_OTT"; value: OttProvider }
  | { type: "SET_MOOD"; value: MoodChoice }
  | { type: "SET_ORIGIN"; value: OriginPreference }
  | { type: "TOGGLE_GENRE"; value: GenreChoice };

export function choiceReducer(
  state: ChoiceFormState,
  action: ChoiceAction,
): ChoiceFormState {
  switch (action.type) {
    case "SET_WHO":
      return {
        ...state,
        who: action.value,
        familyType: action.value === "FAMILY" ? state.familyType : null,
        childAge: action.value === "FAMILY" ? state.childAge : null,
      };
    case "SET_FAMILY_TYPE":
      return {
        ...state,
        familyType: action.value,
        childAge: action.value === "KIDS" ? state.childAge : null,
      };
    case "SET_CHILD_AGE":
      return { ...state, childAge: action.value };
    case "SET_DURATION":
      return { ...state, duration: action.value };
    case "TOGGLE_OTT":
      return {
        ...state,
        otts: state.otts.includes(action.value)
          ? state.otts.filter((provider) => provider !== action.value)
          : [...state.otts, action.value],
      };
    case "SET_MOOD":
      return { ...state, mood: action.value };
    case "SET_ORIGIN":
      return { ...state, origin: action.value };
    case "TOGGLE_GENRE":
      if (state.genres.includes(action.value)) {
        return {
          ...state,
          genres: state.genres.filter((genre) => genre !== action.value),
        };
      }
      if (state.genres.length >= 2) return state;
      return { ...state, genres: [...state.genres, action.value] };
  }
}

export function canAdvanceChoiceStep(
  step: ChoiceStep,
  state: ChoiceFormState,
): boolean {
  switch (step) {
    case 1:
      return Boolean(
        state.who &&
          (state.who !== "FAMILY" ||
            (state.familyType &&
              (state.familyType !== "KIDS" || state.childAge !== null))),
      );
    case 2:
      return state.duration !== undefined;
    case 3:
      return state.otts.length > 0;
    case 4:
      return state.mood !== null;
    case 5:
    case 6:
      return true;
  }
}

export function getChoiceStepError(
  step: ChoiceStep,
  state: ChoiceFormState,
): string {
  if (step === 1) {
    if (!state.who) return "함께 볼 사람을 선택해 주세요.";
    if (state.who === "FAMILY" && !state.familyType) {
      return "함께 볼 가족 구성원을 선택해 주세요.";
    }
    if (
      state.who === "FAMILY" &&
      state.familyType === "KIDS" &&
      !state.childAge
    ) {
      return "아이와 볼 수 있는 관람 등급을 선택해 주세요.";
    }
  }
  if (step === 2 && state.duration === undefined) {
    return "볼 수 있는 시간을 선택해 주세요.";
  }
  if (step === 3 && state.otts.length === 0) {
    return "이용할 수 있는 OTT를 하나 이상 선택해 주세요.";
  }
  if (step === 4 && state.mood === null) {
    return "지금 원하는 분위기를 선택해 주세요.";
  }
  return "";
}

export function genreChoiceToApiGenres(genre: GenreChoice | null): string[] {
  if (!genre) return [];
  if (genre === "SF/판타지") return ["SF", "판타지"];
  if (genre === "공포/스릴러") return ["공포", "스릴러"];
  return [genre];
}

export type ChoiceDraftPayload = Pick<
  ChoiceFormState,
  | "who"
  | "familyType"
  | "childAge"
  | "duration"
  | "otts"
  | "mood"
  | "origin"
  | "genres"
>;

/** Bundles every field collected by the six-step core form before API mapping. */
export function buildChoiceDraftPayload(
  state: ChoiceFormState,
): ChoiceDraftPayload {
  return {
    who: state.who,
    familyType: state.familyType,
    childAge: state.childAge,
    duration: state.duration,
    otts: [...state.otts],
    mood: state.mood,
    origin: state.origin,
    genres: [...state.genres],
  };
}

export function resolveCompanionChoice(state: ChoiceDraftPayload) {
  if (state.who === "FAMILY" && state.familyType === "KIDS") {
    return "WITH_CHILDREN" as const;
  }
  return state.who ?? "ANY";
}

export function childAgeToRatingLimit(
  childAge: ChildAge | null,
): ChildAgeRatingLimit | null {
  if (childAge === "PRESCHOOL") return "ALL";
  if (childAge === "AGE_7") return "7";
  if (childAge === "AGE_12") return "12";
  if (childAge === "AGE_15") return "15";
  return null;
}

/**
 * Creates the strict anonymous recommendation payload. `familyType` and
 * `childAge` remain route-local values; the family branch is mapped to FAMILY
 * or WITH_CHILDREN and the selected age band becomes a viewing-rating policy
 * threshold rather than an exact age.
 */
export function buildRecommendationRequest(
  state: ChoiceFormState,
): MvpRecommendationRequest {
  const draft = buildChoiceDraftPayload(state);
  const desiredGenres = [
    ...new Set(draft.genres.flatMap(genreChoiceToApiGenres)),
  ];
  const mood = draft.mood;
  const companion = resolveCompanionChoice(draft);

  return {
    choice: {
      selectedProviders: draft.otts,
      companions: [companion],
      moods: mood && mood !== "ANY" ? [mood] : [],
      maxRuntimeMinutes: draft.duration ?? null,
      childAgeRatingLimit:
        companion === "WITH_CHILDREN"
          ? childAgeToRatingLimit(draft.childAge)
          : null,
      originPreference: draft.origin ?? "ANY",
      desiredGenres,
      explicitlyRequestedGenres: desiredGenres,
      companionAvoidGenres: [],
    },
  };
}

export function isChoiceDraftDirty(state: ChoiceFormState): boolean {
  return (
    state.who !== null ||
    state.familyType !== null ||
    state.childAge !== null ||
    state.duration !== undefined ||
    state.otts.length > 0 ||
    state.mood !== null ||
    state.origin !== null ||
    state.genres.length > 0
  );
}
