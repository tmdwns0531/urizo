import type { ChoiceStep } from "./choice-types";

type StepNavigationProps = {
  currentStep: ChoiceStep;
  canAdvance: boolean;
  isEditing: boolean;
  isSubmitting: boolean;
  onPrevious: () => void;
  onNext: () => void;
};

export function StepNavigation({
  currentStep,
  canAdvance,
  isEditing,
  isSubmitting,
  onPrevious,
  onNext,
}: StepNavigationProps) {
  const isSummary = currentStep === 6;

  return (
    <footer className="choice-stepper-actions" aria-label="단계 이동">
      <div className="choice-stepper-actions__inner">
        {currentStep > 1 ? (
          <button
            type="button"
            className="choice-stepper-button choice-stepper-button--previous"
            onClick={onPrevious}
          >
            <span aria-hidden="true">←</span>
            {isEditing ? "요약으로" : "이전"}
          </button>
        ) : (
          <span />
        )}

        {isSummary ? (
          <button
            id="choice-submit"
            type="submit"
            className="choice-stepper-button choice-stepper-button--primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "조건을 확인하는 중…" : "추천 시작하기"}
            {!isSubmitting ? <span aria-hidden="true">→</span> : null}
          </button>
        ) : (
          <button
            type="button"
            className="choice-stepper-button choice-stepper-button--primary"
            aria-disabled={!canAdvance}
            onClick={onNext}
          >
            {isEditing ? "수정 완료" : currentStep === 5 ? "선택 확인" : "다음"}
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </footer>
  );
}
