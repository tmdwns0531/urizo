import {
  CHILD_AGE_OPTIONS,
  FAMILY_TYPE_OPTIONS,
} from "../choice-stepper/choice-options";
import type {
  ChildAge,
  FamilyType,
} from "../choice-stepper/choice-types";

export function NaturalAgeStep({
  familyType,
  childAge,
  error,
  onFamilyTypeChange,
  onChildAgeChange,
  onPrevious,
  onSubmit,
}: {
  familyType: FamilyType | null;
  childAge: ChildAge | null;
  error: string;
  onFamilyTypeChange: (value: FamilyType) => void;
  onChildAgeChange: (value: ChildAge) => void;
  onPrevious: () => void;
  onSubmit: () => void;
}) {
  const canContinue =
    familyType === "ADULTS" || (familyType === "KIDS" && childAge !== null);

  return (
    <main className="app-container flex flex-1 items-start py-10 pb-28 sm:items-center sm:py-16">
      <section className="mx-auto w-full max-w-5xl" aria-labelledby="clarify-age-title">
        <header>
          <p className="choice-stepper__eyebrow">한 가지만 더 확인할게요</p>
          <h1
            id="clarify-age-title"
            className="mt-2 text-balance text-3xl font-black tracking-[-0.045em] text-white sm:text-4xl"
          >
            가족과 함께 본다고 이해했어요.
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-300">
            안전한 작품을 고르기 위해 함께 보는 가족 구성을 알려주세요.
          </p>
        </header>

        <form
          className="mt-8 rounded-2xl border border-slate-800 bg-[#191d22] p-5 sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <fieldset>
            <legend className="text-lg font-bold text-white">누가 함께 보나요?</legend>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FAMILY_TYPE_OPTIONS.map((option) => {
                const selected = familyType === option.value;
                return (
                  <label
                    key={option.value}
                    className={`relative cursor-pointer rounded-xl border-2 px-4 py-5 text-center text-sm font-bold transition-colors focus-within:outline-2 focus-within:outline-orange-400 ${
                      selected
                        ? "border-orange-500 bg-orange-500/10 text-orange-300"
                        : "border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="familyType"
                      value={option.value}
                      checked={selected}
                      onChange={() => onFamilyTypeChange(option.value)}
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {familyType === "KIDS" ? (
            <fieldset className="mt-6 border-t border-slate-800 pt-6">
              <legend className="text-base font-bold text-orange-300">
                아이와 볼 수 있는 관람 등급을 골라주세요. (필수)
              </legend>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CHILD_AGE_OPTIONS.map((option) => {
                  const selected = childAge === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-semibold transition-colors focus-within:outline-2 focus-within:outline-orange-400 ${
                        selected
                          ? "border-orange-500 bg-orange-500 text-white"
                          : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name="childAge"
                        value={option.value}
                        checked={selected}
                        onChange={() => onChildAgeChange(option.value)}
                      />
                      <span className="block">{option.label}</span>
                      <small className={`text-sm leading-6 ${selected ? "text-orange-100" : "text-slate-400"}`}>
                        {option.hint}
                      </small>
                    </label>
                  );
                })}
              </div>
              <p className="mt-4 rounded-xl bg-slate-950/55 px-4 py-3 text-sm leading-6 text-slate-300">
                현재 추천 엔진은 정확한 연령 대신 아이 동반 공통 기준
                (전체·7세·12세)을 더 안전하게 적용해요. 선택한 등급은 Choice
                화면으로 이어집니다.
              </p>
            </fieldset>
          ) : null}

          {error ? (
            <p className="choice-stepper-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-7 grid grid-cols-2 gap-3">
            <button
              type="button"
              className="min-h-12 rounded-xl border border-slate-700 px-4 text-sm font-bold text-slate-300 hover:border-slate-500 hover:text-white"
              onClick={onPrevious}
            >
              ← 한마디 수정
            </button>
            <button
              type="submit"
              disabled={!canContinue}
              className="min-h-12 rounded-xl bg-gradient-to-r from-[#ff5430] to-[#ff7c42] px-4 text-sm font-black text-white shadow-[0_10px_30px_rgba(255,89,45,.2)]"
            >
              추천 이어가기 →
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
