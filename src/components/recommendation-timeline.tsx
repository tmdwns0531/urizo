import type { MvpRecommendationResponse } from "@/contracts/mvp-recommendation";

const providerLabels = [
  "Netflix",
  "TVING",
  "Disney+",
  "Wavve",
  "WATCHA",
  "Coupang Play",
];

function appliedConditionDescription(conditionSummary: string) {
  const conditions = conditionSummary.split(" · ");
  const provider = conditions.find(
    (condition) =>
      condition === "모든 OTT" ||
      providerLabels.some((label) => condition.includes(label)),
  );
  const runtime = conditions.find(
    (condition) => condition.endsWith("분 이내") || condition === "시간 제한 없음",
  );
  const mediaType = conditions.find((condition) =>
    ["영화", "시리즈", "작품 유형 제한 없음"].includes(condition),
  );
  const ratingAndGenres = conditions.filter(
    (condition) =>
      condition.startsWith("최대 허용 관람등급") ||
      condition.endsWith(" 필수") ||
      condition.endsWith(" 제외"),
  );
  const sentences = [
    provider
      ? provider === "모든 OTT"
        ? "지원하는 모든 OTT의 작품을 확인했어요."
        : `${provider.replaceAll(", ", "·")}에서 볼 수 있는 작품만 확인했어요.`
      : "이용할 수 있는 OTT 조건을 반영했어요.",
    runtime === "시간 제한 없음"
      ? "시청 시간은 제한하지 않았어요."
      : runtime
        ? `${runtime} 작품만 남겼어요.`
        : "시청 시간 조건을 반영했어요.",
    mediaType === "작품 유형 제한 없음"
      ? "영화와 시리즈를 모두 비교했어요."
      : mediaType
        ? `${mediaType}만 비교했어요.`
        : "작품 유형 조건을 반영했어요.",
    ratingAndGenres.length
      ? `${ratingAndGenres.join("과 ")} 조건을 적용했어요.`
      : "선택한 관람 기준과 장르 조건을 적용했어요.",
  ];
  return sentences.join(" ");
}

export function RecommendationTimeline({
  response,
}: {
  response: MvpRecommendationResponse;
}) {
  const steps = [
    {
      title: "선택한 조건을 먼저 적용했어요.",
      description: appliedConditionDescription(response.conditionSummary),
    },
    {
      title: "조건에 맞는 작품을 비교했어요.",
      description:
        "남은 작품의 분위기, 장르와 취향 일치도를 비교했어요.",
    },
    {
      title: "추천 구성이 한쪽으로 치우치지 않는지 확인했어요.",
      description:
        "비슷한 작품만 반복되지 않도록 후보의 다양성을 살폈어요.",
    },
    {
      title: "최종 추천 전에 다시 확인했어요.",
      description:
        "선택한 조건과 안전 기준을 만족하는 작품만 추천했어요.",
    },
  ];

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
            추천 기준 확인하기
          </strong>
          <small className="mt-1 text-sm leading-6 text-slate-400">
            선택한 조건과 안전 기준이 어떻게 적용됐는지 볼 수 있어요.
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
        {steps.map((step) => (
          <li
            className="relative flex gap-3 py-3 after:absolute after:bottom-[-.75rem] after:left-[.6875rem] after:top-9 after:w-px after:bg-white/10 last:after:hidden"
            key={step.title}
          >
            <span
              className="relative z-10 grid size-7 shrink-0 place-items-center rounded-full bg-emerald-400/10 text-sm font-black text-emerald-300"
              aria-hidden="true"
            >
              ✓
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
      </ol>
    </details>
  );
}
