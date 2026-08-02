import type { ReactNode } from "react";
import {
  CHILD_AGE_OPTIONS,
  DURATION_OPTIONS,
  GENRE_OPTIONS,
  MOOD_OPTIONS,
  NO_COMPANION_OPTION,
  ORIGIN_OPTIONS,
  OTT_OPTIONS,
  WHO_OPTIONS,
} from "./choice-options";
import type { ChoiceFormState, ChoiceStep } from "./choice-types";

type Step6SummaryProps = {
  state: ChoiceFormState;
  onEdit: (step: ChoiceStep) => void;
};

type SummaryRowProps = {
  step: ChoiceStep;
  label: string;
  children: ReactNode;
  onEdit: (step: ChoiceStep) => void;
};

function SummaryRow({ step, label, children, onEdit }: SummaryRowProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-white/10 py-5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <dt className="text-sm font-black uppercase tracking-[0.1em] text-orange-300">
          Step {step} · {label}
        </dt>
        <dd className="mt-1 min-w-0 break-words text-base font-bold leading-7 text-white sm:text-lg">
          {children}
        </dd>
      </div>
      <button
        type="button"
        className="self-center rounded-lg px-2.5 py-2 text-sm font-bold text-slate-400 hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-orange-400"
        onClick={() => onEdit(step)}
        aria-label={`${label} 조건 수정`}
      >
        <span aria-hidden="true">✎ </span>수정
      </button>
    </div>
  );
}

function findLabel<T extends { readonly value: unknown; readonly label: string }>(
  options: readonly T[],
  value: unknown,
) {
  return options.find((option) => option.value === value)?.label;
}

export function Step6Summary({ state, onEdit }: Step6SummaryProps) {
  const ageLabel = findLabel(CHILD_AGE_OPTIONS, state.childAge);
  const baseWhoLabel = findLabel(WHO_OPTIONS, state.who);
  const whoLabel =
    state.who === "ANY"
      ? NO_COMPANION_OPTION.label
      : state.who === "FAMILY" && state.familyType === "ADULTS"
        ? `${baseWhoLabel} · 성인 가족`
        : state.who === "FAMILY" && state.familyType === "KIDS"
          ? `${baseWhoLabel} · 아이 동반${ageLabel ? ` · ${ageLabel}` : ""}`
          : (baseWhoLabel ?? "선택 안 함");
  const durationLabel =
    findLabel(DURATION_OPTIONS, state.duration) ?? "선택 안 함";
  const ottLabels = state.otts
    .map((ott) => findLabel(OTT_OPTIONS, ott) ?? ott)
    .join(", ");
  const moodLabel = findLabel(MOOD_OPTIONS, state.mood) ?? "선택 안 함";
  const originLabel =
    state.origin === null
      ? "선택 안 함"
      : (findLabel(ORIGIN_OPTIONS, state.origin) ?? "선택 안 함");
  const genreLabels = state.genres.map(
    (genre) => findLabel(GENRE_OPTIONS, genre) ?? genre,
  );

  return (
    <section className="space-y-8" aria-labelledby="choice-step-6-title">
      <header className="text-center">
        <span
          className="mx-auto mb-5 grid size-16 place-items-center rounded-full border border-orange-500/50 bg-orange-500/10 text-3xl text-orange-400"
          aria-hidden="true"
        >
          ✓
        </span>
        <p className="choice-stepper__eyebrow">조건 입력 완료</p>
        <h2
          id="choice-step-6-title"
          data-step-heading
          tabIndex={-1}
          className="text-balance text-3xl font-black tracking-[-0.04em] text-white outline-none sm:text-4xl"
        >
          이 조건으로 추천을 시작할까요?
        </h2>
        <p className="mt-3 text-base leading-7 text-slate-300">
          입력한 조건을 다시 확인해 주세요.
        </p>
      </header>

      <dl className="rounded-2xl border border-slate-800 bg-[#191d22] p-5 sm:p-6">
        <SummaryRow step={1} label="누구와" onEdit={onEdit}>
          {whoLabel}
          {state.who === "FAMILY" && state.familyType === "KIDS" ? (
            <small className="mt-2 block text-sm font-medium leading-6 text-slate-400">
              선택한 관람 등급은 현재 결과 필터에 직접 반영되지 않으며, 아이
              동반 공통 기준(전체·7세·12세)이 적용돼요.
            </small>
          ) : null}
        </SummaryRow>

        <SummaryRow step={2} label="시청 시간" onEdit={onEdit}>
          {durationLabel}
        </SummaryRow>

        <SummaryRow step={3} label="이용 OTT" onEdit={onEdit}>
          {ottLabels || "선택 안 함"}
        </SummaryRow>

        <SummaryRow step={4} label="원하는 느낌" onEdit={onEdit}>
          {moodLabel}
        </SummaryRow>

        <SummaryRow step={5} label="취향 더하기" onEdit={onEdit}>
          <span className="block text-sm font-medium leading-6 text-slate-300 sm:text-base">
            제작 지역: {originLabel}
          </span>
          <span className="block text-sm font-medium leading-6 text-slate-300 sm:text-base">
            선호 장르: {genreLabels.length ? genreLabels.join(", ") : "선택 안 함"}
          </span>
        </SummaryRow>
      </dl>
    </section>
  );
}
