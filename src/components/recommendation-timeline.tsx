import type {
  MvpRecommendationResponse as RecommendationResponse,
  TraceMetricKey,
} from "@/contracts/mvp-recommendation";

const traceMetricLabels: Record<TraceMetricKey, string> = {
  candidateCount: "비교한 후보",
  eligibleCount: "조건을 통과한 후보",
  resultCount: "추천 결과",
  blockedCount: "제외한 후보",
  modelCalls: "AI 확인",
  toolCalls: "추천 도구 확인",
  tokens: "AI 처리량",
  durationMs: "소요 시간",
  effectiveRuntimeMinutes: "적용한 시청 시간",
};

function formatTraceMetric(key: TraceMetricKey, value: number): string {
  const unit =
    key === "durationMs"
      ? "ms"
      : key === "effectiveRuntimeMinutes"
        ? "분"
        : key.endsWith("Count")
          ? "편"
          : key.endsWith("Calls")
            ? "회"
            : "";
  return `${traceMetricLabels[key]} ${value}${unit}`;
}

export type RecommendationTimelineStep = {
  title: string;
  description: string;
  kind?: "user" | "default" | "disclosure";
};

export function RecommendationTimeline({
  response,
  interpretationSteps = [],
}: {
  response: RecommendationResponse;
  interpretationSteps?: RecommendationTimelineStep[];
}) {
  const totalSteps = interpretationSteps.length + response.trace.length;

  return (
    <details className="trace-panel">
      <summary>
        <span className="trace-panel__icon" aria-hidden="true">
          ◇
        </span>
        <span>
          <strong>어떻게 골랐는지 모두 보기</strong>
          <small>{totalSteps}단계의 해석과 추천 과정</small>
        </span>
        <i aria-hidden="true">⌄</i>
      </summary>
      <ol className="trace-list">
        {interpretationSteps.map((step, index) => (
          <li className="trace-event trace-event--filter" key={`${step.title}-${index}`}>
            <span aria-hidden="true">
              {step.kind === "default" ? "·" : step.kind === "disclosure" ? "i" : "✓"}
            </span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.description}</p>
            </div>
          </li>
        ))}
        {response.trace.map((event) => (
          <li className={`trace-event trace-event--${event.action}`} key={event.id}>
            <span aria-hidden="true">
              {event.action === "policy_block"
                ? "◇"
                : event.action === "fallback"
                  ? "↯"
                  : event.action === "approval_request"
                    ? "?"
                    : "✓"}
            </span>
            <div>
              <strong>{event.title}</strong>
              <p>{event.description}</p>
              {event.metrics ? (
                <small>
                  {(
                    Object.entries(event.metrics) as Array<
                      [TraceMetricKey, number]
                    >
                  )
                    .map(([key, value]) => formatTraceMetric(key, value))
                    .join(" · ")}
                </small>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <div className="trace-panel__foot">
        <span>추천 과정</span>
        <code>조건 확인 · 후보 비교 · 최종 선택 · 안전 확인</code>
      </div>
    </details>
  );
}
