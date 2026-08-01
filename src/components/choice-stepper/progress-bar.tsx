import type { ChoiceStep } from "./choice-types";

const STEP_LABELS = ["누구와", "시간", "OTT", "느낌", "취향 더하기", "확인"];

type ProgressBarProps = {
  currentStep: ChoiceStep;
};

export function ProgressBar({ currentStep }: ProgressBarProps) {
  const currentLabel = STEP_LABELS[currentStep - 1];
  const progress =
    ((currentStep - 1) / (STEP_LABELS.length - 1)) * 100;

  return (
    <div className="choice-stepper-progress-shell">
      <div
        className="choice-stepper-progress"
        role="progressbar"
        aria-label="조건 선택 진행률"
        aria-valuemin={1}
        aria-valuemax={6}
        aria-valuenow={currentStep}
        aria-valuetext={`6단계 중 ${currentStep}단계, ${currentLabel}`}
      >
        <div className="choice-stepper-progress__meta">
          <span>{currentLabel}</span>
          <strong>{currentStep} / 6</strong>
        </div>
        <div className="choice-stepper-progress__track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
        <ol className="choice-stepper-progress__steps" aria-hidden="true">
          {STEP_LABELS.map((label, index) => (
            <li
              key={label}
              className={
                index + 1 < currentStep
                  ? "is-complete"
                  : index + 1 === currentStep
                    ? "is-active"
                    : undefined
              }
            >
              <span>{index + 1}</span>
              <small>{label}</small>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
