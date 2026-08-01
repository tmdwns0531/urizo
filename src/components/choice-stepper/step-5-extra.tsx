import type { OriginPreference } from "@/contracts/mvp-search";
import { GENRE_OPTIONS, ORIGIN_OPTIONS } from "./choice-options";
import type { ChoiceFormState, GenreChoice } from "./choice-types";

type Step5ExtraProps = {
  state: ChoiceFormState;
  onOriginChange: (value: OriginPreference) => void;
  onToggleGenre: (value: GenreChoice) => void;
};

export function Step5Extra({
  state,
  onOriginChange,
  onToggleGenre,
}: Step5ExtraProps) {
  return (
    <section
      className="choice-stepper__step space-y-6"
      aria-labelledby="choice-step-5-title"
    >
      <header>
        <p className="choice-stepper__eyebrow">STEP 5 · 취향 더하기</p>
        <h2
          id="choice-step-5-title"
          data-step-heading
          tabIndex={-1}
          className="text-balance text-3xl font-black tracking-[-0.04em] text-white outline-none sm:text-4xl"
        >
          취향 더하기
          <span className="ml-2 text-lg font-medium text-slate-500">(선택)</span>
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-400 sm:text-base">
          조금 더 원하는 방향이 있다면 골라주세요. 아무것도 선택하지 않아도
          괜찮아요.
        </p>
      </header>

      <div className="space-y-8 rounded-2xl border border-slate-800 bg-[#191d22] p-5 sm:p-8">
        <fieldset>
          <legend className="mb-3 text-sm font-bold text-slate-300">
            작품 제작 지역 <span className="sr-only">선택 사항</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {ORIGIN_OPTIONS.map((option) => {
              const isSelected = state.origin === option.value;
              return (
                <label
                  key={option.value}
                  className={`cursor-pointer rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-orange-400 ${
                    isSelected
                      ? "border-orange-500 bg-orange-500/15 text-orange-300"
                      : "border-slate-700 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="origin"
                    value={option.value}
                    checked={isSelected}
                    onChange={() => onOriginChange(option.value)}
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset aria-describedby="genre-selection-status">
          <legend className="mb-3 text-sm font-bold text-slate-300">
            선호 장르
            <span className="ml-2 text-xs font-medium text-slate-500">최대 2개</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {GENRE_OPTIONS.map((option) => {
              const isSelected = state.genres.includes(option.value);
              const isBlocked = state.genres.length >= 2 && !isSelected;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400 ${
                    isSelected
                      ? "border-orange-500 bg-orange-500/15 text-orange-300"
                      : isBlocked
                        ? "cursor-not-allowed border-slate-800 text-slate-600"
                        : "border-slate-700 text-slate-400 hover:border-slate-500"
                  }`}
                  aria-pressed={isSelected}
                  aria-disabled={isBlocked}
                  onClick={() => {
                    if (!isBlocked) onToggleGenre(option.value);
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p
            id="genre-selection-status"
            className="mt-3 text-xs text-slate-500"
            aria-live="polite"
          >
            {state.genres.length}/2개 선택
            {state.genres.length >= 2
              ? " · 다른 장르를 고르려면 하나를 해제해 주세요."
              : ""}
          </p>
        </fieldset>
      </div>
    </section>
  );
}
