import type { OttProvider } from "@/contracts/catalog";
import type {
  ChoiceRuntimeMinutes,
  MediaTypePreference,
  OriginPreference,
} from "@/contracts/mvp-search";
import type {
  ChildAge,
  FamilyType,
  GenreChoice,
  MoodChoice,
  WhoChoice,
} from "./choice-types";

export const WHO_OPTIONS: ReadonlyArray<{
  value: WhoChoice;
  label: string;
  icon: string;
  hint: string;
}> = [
  { value: "ALONE", label: "혼자", icon: "●", hint: "오롯이 나만의 시간" },
  { value: "PARTNER", label: "연인과", icon: "♥", hint: "둘이 함께 볼 작품" },
  { value: "FRIENDS", label: "친구와", icon: "♣", hint: "여럿이 즐길 작품" },
  { value: "FAMILY", label: "가족과", icon: "⌂", hint: "가족이 다 같이 볼 작품" },
];

export const NO_COMPANION_OPTION = {
  value: "ANY",
  label: "동반자 조건 없이 추천받기",
} as const satisfies { value: WhoChoice; label: string };

export const FAMILY_TYPE_OPTIONS: ReadonlyArray<{
  value: FamilyType;
  label: string;
}> = [
  { value: "ADULTS", label: "성인 가족끼리 봐요" },
  { value: "KIDS", label: "아이도 함께 봐요" },
];

export const CHILD_AGE_OPTIONS: ReadonlyArray<{
  value: ChildAge;
  label: string;
  hint: string;
}> = [
  { value: "PRESCHOOL", label: "전체 관람가", hint: "영유아와 함께" },
  { value: "AGE_7", label: "7세 이상 관람가", hint: "초등 저학년부터" },
  { value: "AGE_12", label: "12세 이상 관람가", hint: "초등 고학년부터" },
  { value: "AGE_15", label: "15세 이상 관람가", hint: "청소년과 함께" },
];

export const DURATION_OPTIONS: ReadonlyArray<{
  value: ChoiceRuntimeMinutes;
  label: string;
  hint: string;
  icon: string;
}> = [
  { value: 30, label: "30분 이내", hint: "짧고 가볍게", icon: "◴" },
  { value: 60, label: "1시간 이내", hint: "부담 없이", icon: "◷" },
  { value: 120, label: "2시간 이내", hint: "영화 한 편", icon: "◶" },
  { value: 180, label: "3시간 이내", hint: "여유롭게", icon: "◵" },
  { value: null, label: "시간 제한 없음", hint: "러닝타임을 제한하지 않아요", icon: "∞" },
];

export const OTT_OPTIONS: ReadonlyArray<{
  value: OttProvider;
  label: string;
}> = [
  { value: "NETFLIX", label: "Netflix" },
  { value: "TVING", label: "TVING" },
  { value: "DISNEY_PLUS", label: "Disney+" },
  { value: "WAVVE", label: "Wavve" },
  { value: "WATCHA", label: "WATCHA" },
  { value: "COUPANG_PLAY", label: "Coupang Play" },
];

export const MOOD_OPTIONS: ReadonlyArray<{
  value: MoodChoice;
  label: string;
  icon: string;
  hint: string;
}> = [
  {
    value: "밝은",
    label: "가볍게 웃을 수 있는",
    icon: "☀",
    hint: "유쾌한 분위기, 부담 없는 전개",
  },
  {
    value: "따뜻한",
    label: "따뜻하게 위로받는",
    icon: "♡",
    hint: "공감과 회복을 담은 따뜻한 이야기",
  },
  {
    value: "감성적인",
    label: "감정선이 풍부한",
    icon: "☂",
    hint: "감정선, 음악, 관계 중심",
  },
  {
    value: "생각할 거리가 있는",
    label: "여운이 길게 남는",
    icon: "◇",
    hint: "메시지나 결말을 오래 생각하게 하는 작품",
  },
  {
    value: "긴장감 있는",
    label: "심장이 쫄깃해지는",
    icon: "⚡",
    hint: "긴장감과 서스펜스",
  },
  {
    value: "자극적인",
    label: "강렬하고 속도감 있는",
    icon: "✺",
    hint: "액션과 빠른 전개",
  },
  {
    value: "ANY",
    label: "느낌 제한 없음",
    icon: "∞",
    hint: "느낌보다 다른 조건을 우선해요",
  },
];

export const ORIGIN_OPTIONS: ReadonlyArray<{
  value: OriginPreference;
  label: string;
  hint: string;
}> = [
  { value: "KR", label: "한국 작품", hint: "공동 제작 포함" },
  { value: "NON_KR", label: "해외 작품", hint: "한국 외 제작" },
  { value: "ANY", label: "상관없음", hint: "모두 보기" },
];

export const MEDIA_TYPE_OPTIONS: ReadonlyArray<{
  value: MediaTypePreference;
  label: string;
  hint: string;
}> = [
  { value: "MOVIE", label: "영화", hint: "한 편으로 끝나요" },
  { value: "SERIES", label: "시리즈", hint: "회차로 이어져요" },
  { value: "ANY", label: "상관없음", hint: "모두 보기" },
];

export const GENRE_OPTIONS: ReadonlyArray<{
  value: GenreChoice;
  label: string;
}> = [
  { value: "액션", label: "액션" },
  { value: "로맨스", label: "로맨스" },
  { value: "코미디", label: "코미디" },
  { value: "애니메이션", label: "애니메이션" },
  { value: "SF/판타지", label: "SF / 판타지" },
  { value: "공포/스릴러", label: "공포 / 스릴러" },
];
