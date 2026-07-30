import type { DemoScenario } from "../../contracts/recommendation";

export const DEMO_SCENARIO_COPY: Record<
  DemoScenario,
  { label: string; description: string }
> = {
  normal: {
    label: "정상 추천",
    description: "필터, 로컬 검색, 하이브리드 점수, 정책 검사를 거칩니다.",
  },
  approval: {
    label: "승인 게이트",
    description: "30분 후보를 보여준 뒤 45분으로 넓힐지 사용자에게 묻습니다.",
  },
  policy_block: {
    label: "정책 차단",
    description: "응답 직전 안전 정책이 부적합 후보를 제거하는 과정을 보여줍니다.",
  },
  budget_fallback: {
    label: "예산 폴백",
    description: "예산 상한을 강제로 넘겨 결정론적 룰 기반 추천으로 전환합니다.",
  },
};
