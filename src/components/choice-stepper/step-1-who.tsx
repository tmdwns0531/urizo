import {
  CHILD_AGE_OPTIONS,
  FAMILY_TYPE_OPTIONS,
  NO_COMPANION_OPTION,
  WHO_OPTIONS,
} from "./choice-options";
import type { ChildAge, FamilyType, WhoChoice } from "./choice-types";

type Step1WhoProps = {
  who: WhoChoice | null;
  familyType: FamilyType | null;
  childAge: ChildAge | null;
  onWhoChange: (value: WhoChoice) => void;
  onFamilyTypeChange: (value: FamilyType) => void;
  onChildAgeChange: (value: ChildAge) => void;
};

export function Step1Who({
  who,
  familyType,
  childAge,
  onWhoChange,
  onFamilyTypeChange,
  onChildAgeChange,
}: Step1WhoProps) {
  const isFamily = who === "FAMILY";
  const isWithKids = isFamily && familyType === "KIDS";

  return (
    <section
      className="choice-stepper-step space-y-7"
      aria-labelledby="choice-step-1-title"
    >
      <header className="space-y-2">
        <p className="choice-stepper__eyebrow">STEP 1</p>
        <h2
          id="choice-step-1-title"
          data-step-heading
          tabIndex={-1}
          className="text-balance text-3xl font-black tracking-[-0.04em] text-white outline-none sm:text-4xl"
        >
          누구와 보나요?
        </h2>
        <p className="text-sm leading-6 text-slate-400 sm:text-base">
          함께 보는 사람에 맞춰 작품을 골라드릴게요. 하나만 선택해 주세요.
        </p>
      </header>

      <fieldset>
        <legend className="sr-only">함께 보는 사람</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {WHO_OPTIONS.map((option) => {
            const isSelected = who === option.value;
            return (
              <label
                key={option.value}
                className={`choice-stepper-option relative flex min-h-28 cursor-pointer items-start gap-4 rounded-2xl border-2 p-5 text-left transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-orange-400 ${
                  isSelected
                    ? "border-orange-500 bg-orange-500/10"
                    : "border-slate-800 bg-[#191d22] hover:border-slate-600 hover:bg-[#20252b]"
                }`}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="who"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => onWhoChange(option.value)}
                />
                <span
                  aria-hidden="true"
                  className={`grid size-11 shrink-0 place-items-center rounded-full text-xl font-bold ${
                    isSelected
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {option.icon}
                </span>
                <span className="min-w-0 pr-6">
                  <strong className="block text-lg text-slate-100">
                    {option.label}
                  </strong>
                  <small className="mt-1 block text-sm leading-5 text-slate-500">
                    {option.hint}
                  </small>
                </span>
                <span
                  aria-hidden="true"
                  className={`absolute right-4 top-4 grid size-5 place-items-center rounded-full border text-xs font-black ${
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

      {isFamily ? (
        <div className="mt-5 rounded-2xl border border-slate-800 bg-[#191d22] p-5 sm:p-6">
          <fieldset aria-describedby="family-type-help">
            <legend className="text-lg font-bold text-white">
              어떤 가족 구성원과 보나요?
            </legend>
            <p id="family-type-help" className="mt-1 text-sm text-slate-400">
              가족 구성을 선택해야 다음 단계로 넘어갈 수 있어요.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FAMILY_TYPE_OPTIONS.map((option) => {
                const isSelected = familyType === option.value;
                return (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-xl border-2 px-4 py-4 text-center text-sm font-bold transition-colors focus-within:outline-2 focus-within:outline-orange-400 ${
                      isSelected
                        ? "border-orange-500 bg-orange-500/10 text-orange-400"
                        : "border-slate-700 text-slate-400 hover:border-slate-500"
                    }`}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="familyType"
                      value={option.value}
                      checked={isSelected}
                      onChange={() => onFamilyTypeChange(option.value)}
                    />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {isWithKids ? (
            <fieldset
              className="mt-6 border-t border-slate-800 pt-6"
              aria-describedby="child-rating-help child-rating-policy"
            >
              <legend className="text-base font-bold text-orange-300">
                아이와 볼 수 있는 관람 등급을 선택해 주세요. (필수)
              </legend>
              <p id="child-rating-help" className="sr-only">
                관람 등급을 선택해야 다음 단계로 넘어갈 수 있습니다.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CHILD_AGE_OPTIONS.map((option) => {
                  const isSelected = childAge === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-xl border px-4 py-3 text-sm font-semibold transition-colors focus-within:outline-2 focus-within:outline-orange-400 ${
                        isSelected
                          ? "border-orange-500 bg-orange-500 text-white"
                          : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name="childAge"
                        value={option.value}
                        checked={isSelected}
                        onChange={() => onChildAgeChange(option.value)}
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
              <p
                id="child-rating-policy"
                className="mt-4 rounded-xl bg-slate-950/55 px-4 py-3 text-xs leading-5 text-slate-400"
              >
                현재 추천 엔진은 선택한 관람 등급을 결과 필터에 직접 반영하지
                않고, 아이 동반 공통 기준(전체·7세·12세)을 적용합니다.
              </p>
            </fieldset>
          ) : null}
        </div>
      ) : null}

      <div className="mt-7 flex justify-center border-t border-slate-800/70 pt-7">
        <label
          className={`cursor-pointer rounded-full border px-6 py-3 text-sm font-bold transition-colors focus-within:outline-2 focus-within:outline-orange-400 ${
            who === NO_COMPANION_OPTION.value
              ? "border-slate-500 bg-slate-800 text-white"
              : "border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-300"
          }`}
        >
          <input
            className="sr-only"
            type="radio"
            name="who"
            value={NO_COMPANION_OPTION.value}
            checked={who === NO_COMPANION_OPTION.value}
            onChange={() => onWhoChange(NO_COMPANION_OPTION.value)}
          />
          {NO_COMPANION_OPTION.label}
        </label>
      </div>
      </fieldset>
    </section>
  );
}
