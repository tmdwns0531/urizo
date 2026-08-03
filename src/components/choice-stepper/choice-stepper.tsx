"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  snapshotChoiceHandoffDraft,
  useChoiceHandoff,
} from "../choice-handoff/choice-handoff-provider";
import { RecommendationWaitingScreen } from "../advertising/recommendation-waiting-screen";
import { AppShell } from "../app-shell";
import { toAnonymousAdContext } from "../advertising/sponsored-video-ad";
import { ChoiceNav } from "./choice-nav";
import {
  buildRecommendationRequest,
  canAdvanceChoiceStep,
  choiceReducer,
  getChoiceStepError,
  INITIAL_CHOICE_STATE,
  isChoiceDraftDirty,
} from "./choice-state";
import type { ChoiceStep } from "./choice-types";
import { ProgressBar } from "./progress-bar";
import { Step1Who } from "./step-1-who";
import { Step2Time } from "./step-2-time";
import { Step3Ott } from "./step-3-ott";
import { Step4Mood } from "./step-4-mood";
import { Step5Extra } from "./step-5-extra";
import { Step6Summary } from "./step-6-summary";
import { StepNavigation } from "./step-navigation";

const REQUIRED_CONTROL_NAMES: Partial<Record<ChoiceStep, string>> = {
  1: "who",
  2: "duration",
  3: "otts",
  4: "mood",
};

export function ChoiceStepper() {
  const router = useRouter();
  const {
    pendingChoiceHandoff,
    publishChoiceHandoff,
    consumeChoiceHandoff,
  } = useChoiceHandoff();
  const [initialHandoff] = useState(() => pendingChoiceHandoff);
  const [state, dispatch] = useReducer(
    choiceReducer,
    initialHandoff?.draft ?? INITIAL_CHOICE_STATE,
    snapshotChoiceHandoffDraft,
  );
  const [currentStep, setCurrentStep] = useState<ChoiceStep>(
    initialHandoff ? 6 : 1,
  );
  const [returnToSummary, setReturnToSummary] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const stepRootRef = useRef<HTMLDivElement>(null);
  const submitErrorRef = useRef<HTMLParagraphElement>(null);
  const didMountRef = useRef(false);

  const canAdvance = canAdvanceChoiceStep(currentStep, state);
  const dirty = useMemo(() => isChoiceDraftDirty(state), [state]);

  useEffect(() => {
    if (initialHandoff) consumeChoiceHandoff(initialHandoff.token);
  }, [consumeChoiceHandoff, initialHandoff]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    requestAnimationFrame(() => {
      const heading = stepRootRef.current?.querySelector<HTMLElement>(
        "[data-step-heading], #choice-step-heading",
      );
      heading?.focus({ preventScroll: true });
      stepRootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [currentStep]);

  function clearFeedback() {
    setValidationError("");
    setSubmitError("");
  }

  function focusRequiredControl(step: ChoiceStep) {
    const name =
      step === 1 && state.who === "FAMILY" && !state.familyType
        ? "familyType"
        : step === 1 &&
            state.who === "FAMILY" &&
            state.familyType === "KIDS" &&
            !state.childAge
          ? "childAge"
          : REQUIRED_CONTROL_NAMES[step];
    if (!name) return;
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>(`[name="${name}"]`)?.focus();
    });
  }

  function goNext() {
    if (!canAdvanceChoiceStep(currentStep, state)) {
      setValidationError(getChoiceStepError(currentStep, state));
      focusRequiredControl(currentStep);
      return;
    }
    clearFeedback();
    if (returnToSummary) {
      setCurrentStep(6);
      setReturnToSummary(false);
      return;
    }
    setCurrentStep((step) => Math.min(6, step + 1) as ChoiceStep);
  }

  function goPrevious() {
    clearFeedback();
    if (returnToSummary) {
      setCurrentStep(6);
      setReturnToSummary(false);
      return;
    }
    setCurrentStep((step) => Math.max(1, step - 1) as ChoiceStep);
  }

  function editStep(step: ChoiceStep) {
    clearFeedback();
    setReturnToSummary(true);
    setCurrentStep(step);
  }

  async function submitRecommendation() {
    if (isSubmitting) return;
    const invalidStep = ([1, 2, 3, 4] as ChoiceStep[]).find(
      (step) => !canAdvanceChoiceStep(step, state),
    );
    if (invalidStep) {
      setCurrentStep(invalidStep);
      setReturnToSummary(false);
      setValidationError(getChoiceStepError(invalidStep, state));
      focusRequiredControl(invalidStep);
      return;
    }

    setIsSubmitting(true);
    clearFeedback();
    const payload = buildRecommendationRequest(state);

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as
        | { runId?: string; error?: string }
        | null;
      if (!response.ok || !result?.runId) {
        throw new Error(result?.error ?? "추천을 시작하지 못했어요.");
      }
      publishChoiceHandoff(state);
      router.push(`/recommendations/${encodeURIComponent(result.runId)}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "추천을 시작하지 못했어요.",
      );
      setIsSubmitting(false);
      requestAnimationFrame(() => submitErrorRef.current?.focus());
    }
  }

  if (isSubmitting) {
    return (
      <AppShell
        className="choice-stepper-page"
        header={<ChoiceNav dirty={dirty} />}
        contentAsMain={false}
      >
        <main className="flex flex-1">
          <RecommendationWaitingScreen
            stage={1}
            theme="dark"
            context={toAnonymousAdContext(
              buildRecommendationRequest(state).choice,
            )}
          />
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell
      className="choice-stepper-page"
      header={<ChoiceNav dirty={dirty} />}
      contentAsMain={false}
    >
      <form
        id="choice-form"
        className="choice-stepper-form"
        data-choice-dirty={dirty ? "true" : "false"}
        aria-busy={isSubmitting}
        onSubmit={(event) => {
          event.preventDefault();
          if (currentStep < 6) {
            goNext();
            return;
          }
          void submitRecommendation();
        }}
      >
        <ProgressBar currentStep={currentStep} />

        <main className="app-container choice-stepper-main">
          <h1 className="sr-only">OTT 다모아 조건 선택</h1>
          <p className="sr-only" aria-live="polite">
            6단계 중 {currentStep}단계입니다.
          </p>
          <div ref={stepRootRef} className="choice-stepper-content">
            {currentStep === 1 ? (
              <Step1Who
                who={state.who}
                familyType={state.familyType}
                childAge={state.childAge}
                onWhoChange={(value) => {
                  clearFeedback();
                  dispatch({ type: "SET_WHO", value });
                }}
                onFamilyTypeChange={(value) => {
                  clearFeedback();
                  dispatch({ type: "SET_FAMILY_TYPE", value });
                }}
                onChildAgeChange={(value) => {
                  clearFeedback();
                  dispatch({ type: "SET_CHILD_AGE", value });
                }}
              />
            ) : null}
            {currentStep === 2 ? (
              <Step2Time
                duration={state.duration}
                onDurationChange={(value) => {
                  clearFeedback();
                  dispatch({ type: "SET_DURATION", value });
                }}
              />
            ) : null}
            {currentStep === 3 ? (
              <Step3Ott
                otts={state.otts}
                onToggleOtt={(value) => {
                  clearFeedback();
                  dispatch({ type: "TOGGLE_OTT", value });
                }}
              />
            ) : null}
            {currentStep === 4 ? (
              <Step4Mood
                value={state.mood}
                onChange={(value) => {
                  clearFeedback();
                  dispatch({ type: "SET_MOOD", value });
                }}
              />
            ) : null}
            {currentStep === 5 ? (
              <Step5Extra
                state={state}
                onOriginChange={(value) => dispatch({ type: "SET_ORIGIN", value })}
                onMediaTypeChange={(value) =>
                  dispatch({ type: "SET_MEDIA_TYPE", value })
                }
                onToggleGenre={(value) =>
                  dispatch({ type: "TOGGLE_GENRE", value })
                }
              />
            ) : null}
            {currentStep === 6 ? (
              <Step6Summary state={state} onEdit={editStep} />
            ) : null}

            {validationError ? (
              <p className="choice-stepper-error" role="alert">
                {validationError}
              </p>
            ) : null}
            {submitError ? (
              <p
                ref={submitErrorRef}
                className="choice-stepper-error"
                role="alert"
                tabIndex={-1}
              >
                {submitError}
              </p>
            ) : null}
          </div>
        </main>

        <StepNavigation
          currentStep={currentStep}
          canAdvance={canAdvance}
          isEditing={returnToSummary}
          isSubmitting={isSubmitting}
          onPrevious={goPrevious}
          onNext={goNext}
        />
      </form>
    </AppShell>
  );
}
