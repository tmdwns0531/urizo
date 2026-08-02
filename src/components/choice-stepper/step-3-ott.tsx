import type { OttProvider } from "@/contracts/catalog";
import { OTT_OPTIONS } from "./choice-options";

type Step3OttProps = {
  otts: OttProvider[];
  onToggleOtt: (value: OttProvider) => void;
};

export function Step3Ott({ otts, onToggleOtt }: Step3OttProps) {
  const needsSelection = otts.length === 0;

  return (
    <section
      className="choice-stepper-step stepper-step space-y-7"
      aria-labelledby="choice-step-heading"
    >
      <header className="space-y-2">
        <p className="text-sm font-bold tracking-[0.2em] text-orange-400">
          STEP 3
        </p>
        <h2
          id="choice-step-heading"
          tabIndex={-1}
          className="choice-stepper-step__title text-3xl font-black tracking-tight text-white outline-none sm:text-4xl"
        >
          어느 OTT를 이용하나요?
        </h2>
        <p id="ott-selection-help" className="text-base leading-7 text-slate-300">
          구독 중인 OTT를 모두 골라주세요. 최소 1개 이상 선택해야 해요.
        </p>
      </header>

      <fieldset aria-describedby="ott-selection-help ott-selection-status">
        <legend className="sr-only">이용 중인 OTT, 필수, 하나 이상 선택</legend>
        <div className="stepper-option-grid grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-6">
          {OTT_OPTIONS.map((option) => {
            const isSelected = otts.includes(option.value);

            return (
              <label
                key={option.value}
                className={`choice-stepper-option stepper-option relative flex min-h-24 cursor-pointer items-center justify-center rounded-2xl border-2 px-3 py-5 text-center transition focus-within:ring-2 focus-within:ring-orange-400 focus-within:ring-offset-2 focus-within:ring-offset-[#0f1215] ${
                  isSelected
                    ? "border-orange-500 bg-orange-500/10 text-white"
                    : "border-slate-800 bg-[#191d22] text-slate-400 hover:border-slate-600 hover:bg-[#20252b]"
                }`}
              >
                <input
                  className="sr-only"
                  type="checkbox"
                  name="otts"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => onToggleOtt(option.value)}
                />
                <span className="text-base font-extrabold sm:text-lg">
                  {option.label}
                </span>
                <span
                  aria-hidden="true"
                  className={`absolute right-2.5 top-2.5 flex size-6 items-center justify-center rounded-full border text-sm font-black ${
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

      <p
        id="ott-selection-status"
        className={`text-sm leading-6 ${needsSelection ? "text-orange-300" : "text-slate-400"}`}
        aria-live="polite"
      >
        {needsSelection
          ? "구독 중인 OTT를 선택하면 다음 단계로 넘어갈 수 있어요."
          : `${otts.length}개 OTT를 선택했어요.`}
      </p>
    </section>
  );
}
