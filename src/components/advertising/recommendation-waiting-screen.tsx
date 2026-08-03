"use client";

import type { AnonymousAdContext } from "@/contracts/advertising";
import { SponsoredVideoAd } from "./sponsored-video-ad";

type RecommendationWaitingScreenProps = {
  stage: 0 | 1 | 2;
  theme: "light" | "dark";
  context?: AnonymousAdContext;
};

const STEPS = ["조건 확인", "작품 비교", "최종 추천 선택"] as const;

export function RecommendationWaitingScreen({
  stage,
  theme,
  context,
}: RecommendationWaitingScreenProps) {
  const headings = [
    "선택한 조건을 확인하고 있어요.",
    "조건에 맞는 작품을 비교하고 있어요.",
    "마지막 추천을 고르고 있어요.",
  ] as const;

  return (
    <section
      className={`app-container recommendation-waiting recommendation-waiting--${theme}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="recommendation-waiting__grid">
        <div className="recommendation-waiting__progress-panel">
          <span className="recommendation-waiting__mark" aria-hidden="true">
            D
          </span>
          <p className="recommendation-waiting__eyebrow">추천 생성 중</p>
          <h1>{headings[stage]}</h1>
          <p className="recommendation-waiting__description">
            광고 재생 여부와 관계없이 추천이 완료되는 즉시 결과를 보여드려요.
          </p>

          <ol className="recommendation-waiting__steps">
            {STEPS.map((label, index) => {
              const state = index < stage ? "complete" : index === stage ? "active" : "pending";
              return (
                <li data-step-state={state} key={label}>
                  <span aria-hidden="true">
                    {state === "complete" ? "✓" : index + 1}
                  </span>
                  <div>
                    <strong>{label}</strong>
                    <small>
                      {state === "complete"
                        ? "완료"
                        : state === "active"
                          ? "진행 중"
                          : "대기"}
                    </small>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <SponsoredVideoAd
          placement="WAITING"
          theme={theme}
          context={context}
        />
      </div>
    </section>
  );
}
