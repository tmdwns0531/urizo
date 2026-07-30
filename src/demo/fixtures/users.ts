import type { UserContext } from "../../contracts/user";

export const DEMO_ADULT_USER: UserContext = {
  id: "demo-adult",
  displayName: "김민지",
  birthDate: "1997-04-18",
  age: 29,
  isMinor: false,
  subscribedProviders: ["NETFLIX", "TVING", "DISNEY_PLUS"],
  allowUnsubscribedRecommendations: false,
  preferredGenres: ["코미디", "드라마", "미스터리"],
  dislikedGenres: ["고어"],
  watchedContentIds: ["extreme-job"],
  notInterestedContentIds: [],
  bookmarkedContentIds: ["little-forest"],
};

export const DEMO_MINOR_USER: UserContext = {
  id: "demo-minor",
  displayName: "박하준",
  birthDate: "2009-11-03",
  age: 16,
  isMinor: true,
  subscribedProviders: ["NETFLIX", "DISNEY_PLUS"],
  allowUnsubscribedRecommendations: false,
  preferredGenres: ["애니메이션", "코미디", "모험"],
  dislikedGenres: ["공포"],
  watchedContentIds: [],
  notInterestedContentIds: ["dune"],
  bookmarkedContentIds: [],
};

export const DEMO_USERS: readonly UserContext[] = [
  DEMO_ADULT_USER,
  DEMO_MINOR_USER,
];
