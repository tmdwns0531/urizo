import type { OttProvider } from "./catalog";
import type {
  ChildAgeRatingLimit,
  Companion,
  MediaTypePreference,
  Mood,
  MvpRecommendationRequest,
  OriginPreference,
} from "./mvp-search";

export const CURATOR_MAX_TURNS = 6;
export const CURATOR_MESSAGE_MAX_CODE_POINTS = 500;
export const CURATOR_PREFERENCE_SUMMARY_MAX_CODE_POINTS = 240;
export const CURATOR_SEARCH_QUERY_MAX_CODE_POINTS = 140;
export const CURATOR_REPLY_MAX_CODE_POINTS = 320;
export const CURATOR_QUICK_REPLY_MAX_ITEMS = 4;
export const CURATOR_QUICK_REPLY_MAX_CODE_POINTS = 40;
export const CURATOR_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const CURATOR_REQUEST_MAX_BYTES = 3_000_000;

export const CURATOR_PAGE_CONTEXTS = [
  "HOME",
  "CHOICE",
  "PROMPT",
  "RESULT",
  "OTHER",
] as const;
export type CuratorPageContext = (typeof CURATOR_PAGE_CONTEXTS)[number];

export const CURATOR_TOPICS = [
  "MOOD",
  "GENRE",
  "RUNTIME",
  "PROVIDER",
  "COMPANION",
  "MEDIA_TYPE",
  "ORIGIN",
  "CHILD_AGE",
] as const;
export type CuratorTopic = (typeof CURATOR_TOPICS)[number];

export const CURATOR_IMAGE_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type CuratorImageMediaType =
  (typeof CURATOR_IMAGE_MEDIA_TYPES)[number];

export interface CuratorChoiceDraft {
  selectedProviders: OttProvider[];
  companions: Companion[];
  moods: Mood[];
  desiredGenres: string[];
  companionAvoidGenres: string[];
  requiredGenres: string[];
  excludedGenres: string[];
  mediaType: MediaTypePreference;
  naturalRuntimeMinutes: number | null;
  childAgeRatingLimit: ChildAgeRatingLimit | null;
  originPreference: OriginPreference;
}

export interface CuratorState {
  turn: number;
  resolvedTopics: CuratorTopic[];
  preferenceSummary: string;
  searchQuery: string;
  choice: CuratorChoiceDraft;
}

export interface CuratorImageInput {
  mediaType: CuratorImageMediaType;
  /** Raw Base64 only. A data-URL prefix is deliberately rejected. */
  base64: string;
}

export interface CuratorTurnRequest {
  pageContext: CuratorPageContext;
  message: string | null;
  image: CuratorImageInput | null;
  state: CuratorState;
}

export type CuratorAction = "ASK" | "READY";

export interface CuratorTurnResponse {
  action: CuratorAction;
  reply: string;
  questionTopic: CuratorTopic | null;
  quickReplies: string[];
  state: CuratorState;
  handoff: MvpRecommendationRequest | null;
  fallbackUsed: boolean;
}

export interface CuratorModelOutput {
  action: CuratorAction;
  reply: string;
  questionTopic: CuratorTopic | null;
  quickReplies: string[];
  resolvedTopics: CuratorTopic[];
  preferenceSummary: string;
  searchQuery: string;
  choice: CuratorChoiceDraft;
}

export interface ResolvedCuratorTurnRequest extends CuratorTurnRequest {
  message: string | null;
}

export interface CuratorConversationInterpreter {
  interpret(
    request: ResolvedCuratorTurnRequest,
    signal?: AbortSignal,
  ): Promise<CuratorModelOutput>;
}

export interface CuratorServices {
  turn(request: unknown, signal?: AbortSignal): Promise<CuratorTurnResponse>;
}

export const INITIAL_CURATOR_STATE = {
  turn: 0,
  resolvedTopics: [],
  preferenceSummary: "",
  searchQuery: "",
  choice: {
    selectedProviders: [],
    companions: ["ANY"],
    moods: [],
    desiredGenres: [],
    companionAvoidGenres: [],
    requiredGenres: [],
    excludedGenres: [],
    mediaType: "ANY",
    naturalRuntimeMinutes: null,
    childAgeRatingLimit: null,
    originPreference: "ANY",
  },
} as const satisfies CuratorState;

export const CURATOR_API_ENDPOINT = {
  turn: {
    method: "POST",
    path: "/api/curator/turn",
    successStatus: 200,
    errorStatuses: [400, 500],
  },
} as const;
