import type { OttProvider } from "@/contracts/catalog";
import type {
  ChoiceRuntimeMinutes,
  Companion,
  MediaTypePreference,
  Mood,
  OriginPreference,
} from "@/contracts/mvp-search";

export type ChoiceStep = 1 | 2 | 3 | 4 | 5 | 6;

export type ChildAge = "PRESCHOOL" | "AGE_7" | "AGE_12" | "AGE_15";

export type FamilyType = "ADULTS" | "KIDS";

export type WhoChoice = Exclude<Companion, "WITH_CHILDREN">;

export type MoodChoice = Mood | "ANY";

export type GenreChoice =
  | "액션"
  | "로맨스"
  | "코미디"
  | "애니메이션"
  | "SF/판타지"
  | "공포/스릴러";

/**
 * Route-local draft state. `undefined` means that a required question has not
 * been answered yet, while `null` is the user's explicit "상관없음" answer.
 */
export type ChoiceFormState = {
  who: WhoChoice | null;
  familyType: FamilyType | null;
  childAge: ChildAge | null;
  duration: ChoiceRuntimeMinutes | undefined;
  otts: OttProvider[];
  mood: MoodChoice | null;
  origin: OriginPreference | null;
  mediaType: MediaTypePreference | null;
  genres: GenreChoice[];
};
