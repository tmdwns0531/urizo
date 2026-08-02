import { MOOD_OPTIONS } from "./choice-options";
import type { ChoiceFormState, MoodChoice } from "./choice-types";

type Step4MoodProps = {
  readonly value: ChoiceFormState["mood"];
  readonly onChange: (value: MoodChoice) => void;
};

export function Step4Mood({ value, onChange }: Step4MoodProps) {
  return (
    <section
      className="choice-stepper__step space-y-6"
      aria-labelledby="choice-step-4-title"
    >
      <header className="choice-stepper__step-heading">
        <p className="choice-stepper__eyebrow">STEP 4 · 느낌</p>
        <h2
          id="choice-step-4-title"
          className="text-balance text-3xl font-black tracking-[-0.04em] text-white outline-none sm:text-4xl"
          tabIndex={-1}
          data-step-heading
        >
          오늘 어떤 느낌의 작품이 끌리나요?
        </h2>
        <p className="mt-2 text-base leading-7 text-slate-300">
          지금 가장 원하는 느낌 하나를 골라주세요. 선택한 느낌을 추천 순위에
          반영할게요.
        </p>
      </header>

      <fieldset aria-labelledby="choice-step-4-title">
        <legend className="sr-only">원하는 느낌 한 가지 선택</legend>
        <div className="choice-stepper__mood-list grid grid-cols-1 gap-3 lg:grid-cols-2">
          {MOOD_OPTIONS.map((option) => {
            const isSelected = value === option.value;

            return (
              <label
                className={`choice-stepper__option relative flex min-h-20 cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 px-5 py-4 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-orange-400 sm:px-6 ${
                  isSelected
                    ? "border-[#ff7043] bg-[#ff7043]/10 text-white"
                    : "border-white/10 bg-white/[0.035] text-slate-300 hover:border-white/20 hover:bg-white/[0.055]"
                }`}
                key={option.value}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="mood"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => onChange(option.value)}
                />
                <span className="min-w-0">
                  <strong className="block text-lg text-slate-100 sm:text-xl">
                    {option.label}
                  </strong>
                  <small
                    className={`mt-1 block text-sm ${
                      isSelected ? "text-orange-200" : "text-slate-400"
                    }`}
                  >
                    {option.hint}
                  </small>
                </span>
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full border text-sm ${
                    isSelected
                      ? "border-[#ff7043] bg-[#ff7043] text-white"
                      : "border-slate-600 text-transparent"
                  }`}
                  aria-hidden="true"
                >
                  ✓
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </section>
  );
}
