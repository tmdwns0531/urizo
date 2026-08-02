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
    <details className="group overflow-hidden rounded-2xl border border-white/10 bg-[#171b21] shadow-[0_16px_45px_rgba(0,0,0,.16)]">
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-4 py-3 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-orange-400 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-400/10 font-black text-emerald-300"
          aria-hidden="true"
        >
          ◇
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <strong className="text-sm font-black text-white">
            어떻게 골랐는지 모두 보기
          </strong>
          <small className="mt-1 text-sm leading-6 text-slate-400">
            {totalSteps}단계의 해석과 추천 과정
          </small>
        </span>
        <i
          className="not-italic text-slate-400 transition-transform group-open:rotate-180"
          aria-hidden="true"
        >
          ⌄
        </i>
      </summary>
      <ol className="grid list-none gap-0 border-t border-white/10 px-4 py-3 sm:px-5">
        {interpretationSteps.map((step, index) => (
          <li
            className="relative flex gap-3 py-2.5 after:absolute after:bottom-[-.625rem] after:left-[.6875rem] after:top-8 after:w-px after:bg-white/10 last:after:hidden"
            key={`${step.title}-${index}`}
          >
            <span
              className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full bg-orange-400/10 text-sm font-black text-orange-200"
              aria-hidden="true"
            >
              {step.kind === "default" ? "·" : step.kind === "disclosure" ? "i" : "✓"}
            </span>
            <div className="min-w-0">
              <strong className="block text-sm font-black leading-6 text-slate-100">
                {step.title}
              </strong>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                {step.description}
              </p>
            </div>
          </li>
        ))}
        {response.trace.map((event) => (
          <li
            className="relative flex gap-3 py-2.5 after:absolute after:bottom-[-.625rem] after:left-[.6875rem] after:top-8 after:w-px after:bg-white/10 last:after:hidden"
            key={event.id}
          >
            <span
              className={`relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-sm font-black ${
                event.action === "fallback"
                  ? "bg-amber-400/10 text-amber-300"
                  : event.action === "approval_request" ||
                      event.action === "approval_decision"
                    ? "bg-orange-400/10 text-orange-300"
                    : "bg-emerald-400/10 text-emerald-300"
              }`}
              aria-hidden="true"
            >
              {event.action === "policy_block"
                ? "◇"
                : event.action === "fallback"
                  ? "↯"
                  : event.action === "approval_request"
                    ? "?"
                    : "✓"}
            </span>
            <div className="min-w-0">
              <strong className="block text-sm font-black leading-6 text-slate-100">
                {event.title}
              </strong>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                {event.description}
              </p>
              {event.metrics ? (
                <small className="mt-2 block break-words text-sm leading-6 text-slate-400">
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
      <div className="flex flex-col border-t border-dashed border-white/10 px-5 py-4 text-sm leading-6 text-slate-400">
        <span className="font-bold">추천 과정</span>
        <code className="mt-1 w-fit border-white/10 bg-white/5 text-slate-400">
          조건 확인 · 후보 비교 · 최종 선택 · 안전 확인
        </code>
      </div>
    </details>
  );
}
