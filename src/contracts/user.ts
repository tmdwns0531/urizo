export const OTT_PROVIDERS = [
  "NETFLIX",
  "TVING",
  "DISNEY_PLUS",
  "WAVVE",
  "WATCHA",
  "COUPANG_PLAY",
] as const;

export type OttProvider = (typeof OTT_PROVIDERS)[number];

export interface UserContext {
  id: string;
  displayName: string;
  birthDate: string;
  age: number;
  isMinor: boolean;
  subscribedProviders: OttProvider[];
  allowUnsubscribedRecommendations: boolean;
  preferredGenres: string[];
  dislikedGenres: string[];
  watchedContentIds: string[];
  notInterestedContentIds: string[];
  bookmarkedContentIds: string[];
}

export type UserProfilePatch = Partial<
  Pick<
    UserContext,
    | "displayName"
    | "birthDate"
    | "subscribedProviders"
    | "allowUnsubscribedRecommendations"
    | "preferredGenres"
    | "dislikedGenres"
  >
>;
