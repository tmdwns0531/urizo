import { MVP_BUDGET_LIMITS } from "../contracts/mvp-recommendation";

export interface RecommendationWeights {
  semantic: number;
  mood: number;
  genre: number;
  runtime: number;
  quality: number;
  companion: number;
}

/**
 * v0.5 §8.5 initial weights. Keeping them here, rather than in the scoring
 * implementation, lets the team tune reviewed cases without changing logic.
 */
export const RECOMMENDATION_WEIGHTS = {
  withNaturalLanguage: {
    semantic: 0.3,
    mood: 0.22,
    genre: 0.2,
    runtime: 0.13,
    quality: 0.1,
    companion: 0.05,
  },
  withoutNaturalLanguage: {
    semantic: 0.15,
    mood: 0.29,
    genre: 0.26,
    runtime: 0.15,
    quality: 0.1,
    companion: 0.05,
  },
} as const satisfies Record<string, RecommendationWeights>;

export const DIVERSITY_PENALTY_PER_REPEAT = 0.12;

export const BUDGET_LIMITS = MVP_BUDGET_LIMITS;

export const RESULT_LIMIT = 5;

/**
 * 검색이 가져오는 후보 수. 교체는 재검색 없이 이 목록을 순서대로 내려가므로
 * (orchestrator.replace), 이 값이 곧 "다른 작품 추천" 을 누를 수 있는 깊이다.
 *
 * 30 일 때 분위기가 일치하는 후보가 `어두운` 3편·`잔잔한` 3편뿐이라 TOP5 가
 * 다 써버렸고, 첫 교체부터 분위기 불일치 작품이 나와 매치율이 한 번에 약 39점
 * 떨어졌다(장르 미선택 시 mood 가중치가 0.29→0.39 로 재정규화되기 때문).
 * 같은 조건에서 일치 후보는 60 이면 `어두운` 5편, 120 이면 10편이 된다.
 *
 * 교체는 selector 를 부르지 않으므로(selectionMode "ranked") 이 값을 올려도
 * 교체 비용은 그대로다. 모델 비용은 SELECTOR_CANDIDATE_LIMIT 이 정한다.
 *
 * 250 인 이유: 분위기 태그가 붙은 작품이라도 임베딩 유사도가 낮으면 후보
 * 커트라인에 걸려 아예 점수 계산에 들어오지 못한다. 실측으로 `밝은` 8편의
 * 유사도가 0.16~0.27 이었는데 120 커트라인이 그보다 높아 6편이 잘렸고,
 * TOP5 가 2/5 로 나왔다. 익명 가용 후보가 312 편이라 250 이면 분위기 태그가
 * 있는 작품은 사실상 전부 점수 계산까지 도달한다. 카탈로그가 수천 편 규모로
 * 커지면 이 값을 다시 검토해야 한다.
 */
export const SEARCH_LIMIT = 250;

/**
 * selector 모델에 넘기는 후보 수. 후보 목록이 그대로 프롬프트에 들어가므로
 * 토큰이 후보 수에 비례한다 — 실측으로 30편 2,674 토큰, 60편 5,147 토큰이라
 * 60 을 넘으면 BUDGET_LIMITS.tokens(8,000)에 닿아 fallback 위험이 생겼다.
 *
 * 그래서 검색 깊이(SEARCH_LIMIT)와 모델이 보는 양을 분리한다. 목록은 이미
 * 점수순이고 mood 가중치가 커서, 상위 30 편 안에 분위기 일치 후보가 먼저
 * 들어온다. 나머지는 교체용 재고로 남는다.
 */
export const SELECTOR_CANDIDATE_LIMIT = 30;
