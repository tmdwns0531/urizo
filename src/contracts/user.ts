import type { OttProvider } from "./catalog";

/**
 * @deprecated Import OTT_PROVIDERS and OttProvider from "./catalog".
 */
export { OTT_PROVIDERS } from "./catalog";
/** @deprecated Import OttProvider from "./catalog". */
export type { OttProvider } from "./catalog";

/** @deprecated Removed from the v0.6 anonymous MVP active contract. */
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

/** @deprecated Removed from the v0.6 anonymous MVP active contract. */
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
