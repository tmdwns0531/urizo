import type { ChoiceRuntimeMinutes } from "@/contracts/mvp-search";
import { DURATION_OPTIONS } from "./choice-options";

type Step2TimeProps = {
  duration: ChoiceRuntimeMinutes | undefined;
  onDurationChange: (value: ChoiceRuntimeMinutes) => void;
};

export function Step2Time({
  duration,
  onDurationChange,
}: Step2TimeProps) {
  return (
    <section
      className="choice-stepper-step stepper-step space-y-7"
      aria-labelledby="choice-step-heading"
    >
      <header className="space-y-2">
        <p className="text-sm font-bold tracking-[0.2em] text-orange-400">
          STEP 2
        </p>
        <h2
          id="choice-step-heading"
          tabIndex={-1}
          className="choice-stepper-step__title text-3xl font-black tracking-tight text-white outline-none sm:text-4xl"
        >
          지금 최대 얼마나 볼 수 있나요?
        </h2>
        <p className="text-base leading-7 text-slate-300">
          지금 볼 수 있는 시간을 골라주세요. 영화는 한 편, 드라마는 한 회
          기준이에요.
        </p>
      </header>

      <fieldset>
        <legend className="sr-only">최대 시청 가능 시간</legend>
        <div className="stepper-option-grid grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {DURATION_OPTIONS.map((option) => {
            const isSelected = duration === option.value;

            return (
              <label
                key={option.label}
                className={`choice-stepper-option stepper-option relative flex min-h-24 cursor-pointer flex-col justify-center rounded-2xl border-2 p-5 transition focus-within:ring-2 focus-within:ring-orange-400 focus-within:ring-offset-2 focus-within:ring-offset-[#0f1215] ${
                  isSelected
                    ? "border-orange-500 bg-orange-500/10"
                    : "border-slate-800 bg-[#191d22] hover:border-slate-600 hover:bg-[#20252b]"
                }`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="duration"
                  value={option.value === null ? "ANY" : option.value}
                  checked={isSelected}
                  onChange={() => onDurationChange(option.value)}
                  required
                />
                <span
                  className={`text-lg font-bold ${
                    isSelected ? "text-white" : "text-slate-200"
                  }`}
                >
                  {option.label}
                </span>
                <span className="mt-2 text-sm leading-6 text-slate-400">
                  {option.hint}
                </span>
                <span
                  aria-hidden="true"
                  className={`absolute right-4 top-4 flex size-6 items-center justify-center rounded-full border text-sm font-black ${
                    isSelected
                      ? "border-orange-400 bg-orange-500 text-white"
                      : "border-slate-700 text-transparent"
                  }`}
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
