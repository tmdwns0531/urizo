export type LandingPoster = {
  readonly id: string;
  readonly title: string;
  readonly year: number;
  readonly detail: string;
  readonly provider: string;
  readonly posterUrl: string;
  readonly backdropColor: string;
};

export type LandingFeature = {
  readonly id: "context" | "conditions" | "compare" | "explain";
  readonly step: string;
  readonly title: string;
  readonly description: string;
};

const tmdbPoster = (path: string) => `https://image.tmdb.org/t/p/w500${path}`;

export const SUPPORTED_PROVIDERS = [
  "Netflix",
  "TVING",
  "Disney+",
  "Wavve",
  "WATCHA",
  "Coupang Play",
] as const;

export const LANDING_POSTERS: readonly LandingPoster[] = [
  {
    id: "midnight-diner",
    title: "심야식당",
    year: 2009,
    detail: "드라마 · 일상",
    provider: "Netflix",
    posterUrl: tmdbPoster("/4a4BE3OgS3slYh1U4lCJAh7ZKVr.jpg"),
    backdropColor: "#76513d",
  },
  {
    id: "modern-family",
    title: "모던 패밀리",
    year: 2009,
    detail: "코미디 · 가족",
    provider: "Disney+",
    posterUrl: tmdbPoster("/k5Qg5rgPoKdh3yTJJrLtyoyYGwC.jpg"),
    backdropColor: "#a9743d",
  },
  {
    id: "brooklyn-nine-nine",
    title: "브루클린 나인-나인",
    year: 2013,
    detail: "코미디 · 범죄",
    provider: "Netflix",
    posterUrl: tmdbPoster("/mpjlDzVjp7oyHUe2LaF9ltKe6f1.jpg"),
    backdropColor: "#894449",
  },
  {
    id: "the-bear",
    title: "더 베어",
    year: 2022,
    detail: "드라마 · 코미디",
    provider: "Disney+",
    posterUrl: tmdbPoster("/t23nESlKRH1qQYWIoUQCOWkS2dl.jpg"),
    backdropColor: "#23445e",
  },
  {
    id: "moving",
    title: "무빙",
    year: 2023,
    detail: "액션 · 드라마",
    provider: "Disney+",
    posterUrl: tmdbPoster("/b9MhD5syJ7TbYSeje4wB4oyTzc7.jpg"),
    backdropColor: "#26394d",
  },
  {
    id: "anne-with-an-e",
    title: "빨간 머리 앤",
    year: 2017,
    detail: "드라마 · 가족",
    provider: "Netflix",
    posterUrl: tmdbPoster("/lKUYNB42aCLYEO7368W5EkjtwAt.jpg"),
    backdropColor: "#596840",
  },
  {
    id: "hospital-playlist",
    title: "슬기로운 의사생활",
    year: 2020,
    detail: "드라마 · 휴먼",
    provider: "TVING · Netflix",
    posterUrl: tmdbPoster("/zy0FJYPsKkfOrZG5r5lFtTIx1up.jpg"),
    backdropColor: "#4b7479",
  },
  {
    id: "reply-1988",
    title: "응답하라 1988",
    year: 2015,
    detail: "드라마 · 가족",
    provider: "TVING · Netflix",
    posterUrl: tmdbPoster("/lZo7G1kEU70PHP1dCe46I0cUKiF.jpg"),
    backdropColor: "#9b6843",
  },
  {
    id: "little-forest",
    title: "리틀 포레스트",
    year: 2018,
    detail: "드라마 · 힐링",
    provider: "TVING · Netflix",
    posterUrl: tmdbPoster("/adoiOpcuBUKeEqfzLqY47VBZN86.jpg"),
    backdropColor: "#567549",
  },
  {
    id: "extreme-job",
    title: "극한직업",
    year: 2019,
    detail: "코미디 · 액션",
    provider: "TVING",
    posterUrl: tmdbPoster("/lzzb384pgYyr0GQvu3K2ZW62CEE.jpg"),
    backdropColor: "#9e6d2e",
  },
] as const;

export const HERO_POSTERS = LANDING_POSTERS.slice(1, 7);
export const PREVIEW_POSTERS = [
  LANDING_POSTERS[8],
  LANDING_POSTERS[9],
  LANDING_POSTERS[1],
] as const;

export const LANDING_FEATURES: readonly LandingFeature[] = [
  {
    id: "context",
    step: "01",
    title: "지금 볼 수 있는 작품부터",
    description:
      "재생할 수 없는 추천은 의미가 없으니까. 연령, 구독 중인 OTT, 시청 가능 시간을 가장 먼저 확인해요.",
  },
  {
    id: "conditions",
    step: "02",
    title: "조건을 바꾸기 전에 먼저 확인",
    description:
      "조건에 맞는 결과가 부족해도 몰래 기준을 넓히지 않아요. 범위를 넓혀도 괜찮은지 먼저 물어볼게요.",
  },
  {
    id: "compare",
    step: "03",
    title: "비교하기 좋은 수로 정리",
    description:
      "선택지가 너무 많으면 다시 고르기 힘들어요. 확실한 기준을 통과한 핵심 후보 딱 5편만 추려서 보여드려요.",
  },
  {
    id: "explain",
    step: "04",
    title: "왜 골랐는지 한눈에",
    description:
      "내가 고른 조건들이 이 작품의 어떤 부분과 맞았는지, 응답 직전 한 번 더 검사하고 그 이유를 투명하게 알려드려요.",
  },
] as const;
