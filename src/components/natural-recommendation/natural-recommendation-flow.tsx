"use client";

import { useEffect, useReducer, useRef } from "react";
import type {
  MvpApprovalDecision,
  MvpRecommendationResponse,
} from "../../contracts/mvp-recommendation";
import type {
  ChildAge,
  FamilyType,
} from "../choice-stepper/choice-types";
import { NaturalAgeStep } from "./natural-age-step";
import { NaturalInputStep } from "./natural-input-step";
import {
  buildNaturalRecommendationRequest,
  hasExplicitChildKeyword,
  interpretNaturalRequest,
  type NaturalFamilyClarification,
  type NaturalInterpretation,
  requiresAgeClarification,
} from "./natural-language";
import {
  NaturalLoadingStep,
  type NaturalLoadingStepName,
} from "./natural-loading-step";
import { NaturalRecommendationNav } from "./natural-nav";
import { NaturalRecommendationResult } from "./natural-result";

export type NaturalFlowStep =
  | "input"
  | "clarify_age"
  | "analyzing"
  | "matching"
  | "result";

type NaturalFlowState = {
  step: NaturalFlowStep;
  input: string;
  familyType: FamilyType | null;
  childAge: ChildAge | null;
  interpretation: NaturalInterpretation | null;
  response: MvpRecommendationResponse | null;
  error: string;
  deciding: MvpApprovalDecision | null;
  decisionError: string;
};

type NaturalFlowAction =
  | { type: "SET_INPUT"; value: string }
  | { type: "SHOW_INPUT" }
  | { type: "SHOW_CLARIFICATION"; familyType: FamilyType | null }
  | { type: "SET_FAMILY_TYPE"; value: FamilyType }
  | { type: "SET_CHILD_AGE"; value: ChildAge }
  | { type: "VALIDATION_ERROR"; value: string }
  | { type: "START_REQUEST"; interpretation: NaturalInterpretation }
  | { type: "SHOW_MATCHING" }
  | { type: "SHOW_RESULT"; response: MvpRecommendationResponse }
  | { type: "REQUEST_ERROR"; value: string }
  | { type: "START_DECISION"; decision: MvpApprovalDecision }
  | { type: "DECISION_RESULT"; response: MvpRecommendationResponse }
  | { type: "DECISION_ERROR"; value: string }
  | { type: "RESET" };

const INITIAL_NATURAL_FLOW_STATE: NaturalFlowState = {
  step: "input",
  input: "",
  familyType: null,
  childAge: null,
  interpretation: null,
  response: null,
  error: "",
  deciding: null,
  decisionError: "",
};

function naturalFlowReducer(
  state: NaturalFlowState,
  action: NaturalFlowAction,
): NaturalFlowState {
  switch (action.type) {
    case "SET_INPUT":
      return { ...state, input: action.value, error: "" };
    case "SHOW_INPUT":
      return {
        ...state,
        step: "input",
        interpretation: null,
        response: null,
        error: "",
        deciding: null,
        decisionError: "",
      };
    case "SHOW_CLARIFICATION":
      return {
        ...state,
        step: "clarify_age",
        familyType: action.familyType,
        childAge: action.familyType === "KIDS" ? state.childAge : null,
        error: "",
      };
    case "SET_FAMILY_TYPE":
      return {
        ...state,
        familyType: action.value,
        childAge: action.value === "KIDS" ? state.childAge : null,
        error: "",
      };
    case "SET_CHILD_AGE":
      return { ...state, childAge: action.value, error: "" };
    case "VALIDATION_ERROR":
      return { ...state, error: action.value };
    case "START_REQUEST":
      return {
        ...state,
        step: "analyzing",
        interpretation: action.interpretation,
        response: null,
        error: "",
        deciding: null,
        decisionError: "",
      };
    case "SHOW_MATCHING":
      return state.step === "analyzing" ? { ...state, step: "matching" } : state;
    case "SHOW_RESULT":
      return {
        ...state,
        step: "result",
        response: action.response,
        error: "",
      };
    case "REQUEST_ERROR":
      return {
        ...state,
        step: "input",
        interpretation: null,
        response: null,
        error: action.value,
      };
    case "START_DECISION":
      return { ...state, deciding: action.decision, decisionError: "" };
    case "DECISION_RESULT":
      return {
        ...state,
        response: action.response,
        deciding: null,
        decisionError: "",
      };
    case "DECISION_ERROR":
      return { ...state, deciding: null, decisionError: action.value };
    case "RESET":
      return INITIAL_NATURAL_FLOW_STATE;
  }
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function isRecommendationResponse(
  value: unknown,
): value is MvpRecommendationResponse {
  if (!value || typeof value !== "object") return false;
  const status = (value as { status?: unknown }).status;
  return status === "completed" || status === "awaiting_approval";
}

async function readRecommendationResponse(response: Response) {
  const result = (await response.json().catch(() => null)) as
    | MvpRecommendationResponse
    | { error?: string }
    | null;
  if (!response.ok || !isRecommendationResponse(result)) {
    throw new Error(
      (result && "error" in result && result.error) ||
        "추천을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.",
    );
  }
  return result;
}

export function NaturalRecommendationFlow() {
  const [state, dispatch] = useReducer(
    naturalFlowReducer,
    INITIAL_NATURAL_FLOW_STATE,
  );
  const activeRequest = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    return () => activeRequest.current?.abort();
  }, []);

  function cancelActiveRequest() {
    requestSequence.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
  }

  async function startRecommendation(
    clarification?: NaturalFamilyClarification,
  ) {
    const input = state.input.trim();
    let interpretation: NaturalInterpretation;
    try {
      interpretation = interpretNaturalRequest(input, clarification);
    } catch (error) {
      dispatch({
        type: "VALIDATION_ERROR",
        value: error instanceof Error ? error.message : "조건을 다시 확인해 주세요.",
      });
      return;
    }

    cancelActiveRequest();
    const controller = new AbortController();
    activeRequest.current = controller;
    const requestId = requestSequence.current;
    dispatch({ type: "START_REQUEST", interpretation });

    const requestOutcome = fetch("/api/recommendations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        buildNaturalRecommendationRequest(input, interpretation),
      ),
      signal: controller.signal,
    })
      .then(readRecommendationResponse)
      .then(
        (value) => ({
          ok: true as const,
          value,
        }),
        (error: unknown) => ({ ok: false as const, error }),
      );

    const isActive = () =>
      requestSequence.current === requestId && !controller.signal.aborted;

    await wait(900);
    if (!isActive()) return;
    dispatch({ type: "SHOW_MATCHING" });

    const [outcome] = await Promise.all([requestOutcome, wait(1_100)]);
    if (!isActive()) return;

    if (!outcome.ok) {
      activeRequest.current = null;
      const requestError = outcome.error;
      if (
        requestError instanceof DOMException &&
        requestError.name === "AbortError"
      ) {
        return;
      }
      dispatch({
        type: "REQUEST_ERROR",
        value:
          requestError instanceof Error
            ? requestError.message
            : "추천을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.",
      });
      return;
    }

    activeRequest.current = null;
    dispatch({ type: "SHOW_RESULT", response: outcome.value });
  }

  function submitInput() {
    const input = state.input.trim();
    if (!input) {
      dispatch({
        type: "VALIDATION_ERROR",
        value: "보고 싶은 작품을 한마디로 적어주세요.",
      });
      return;
    }
    if (requiresAgeClarification(input)) {
      dispatch({
        type: "SHOW_CLARIFICATION",
        familyType: hasExplicitChildKeyword(input) ? "KIDS" : null,
      });
      return;
    }
    void startRecommendation();
  }

  function submitClarification() {
    if (!state.familyType) {
      dispatch({ type: "VALIDATION_ERROR", value: "함께 보는 가족 구성을 선택해 주세요." });
      return;
    }
    if (state.familyType === "KIDS" && !state.childAge) {
      dispatch({ type: "VALIDATION_ERROR", value: "아이와 볼 수 있는 관람 등급을 선택해 주세요." });
      return;
    }
    void startRecommendation({
      familyType: state.familyType,
      childAge: state.familyType === "KIDS" ? state.childAge : null,
    });
  }

  async function decideApproval(decision: MvpApprovalDecision) {
    const response = state.response;
    if (response?.status !== "awaiting_approval" || state.deciding) return;
    dispatch({ type: "START_DECISION", decision });
    try {
      const request = await fetch(
        `/api/recommendations/${encodeURIComponent(response.runId)}/approval`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      const result = await readRecommendationResponse(request);
      dispatch({ type: "DECISION_RESULT", response: result });
    } catch (error) {
      dispatch({
        type: "DECISION_ERROR",
        value:
          error instanceof Error
            ? error.message
            : "조건 변경 결과를 반영하지 못했어요.",
      });
    }
  }

  function resetFlow() {
    cancelActiveRequest();
    dispatch({ type: "RESET" });
  }

  function confirmAndReset() {
    if (
      state.input.trim() &&
      !window.confirm("입력한 한마디가 초기화됩니다. 처음부터 다시 할까요?")
    ) {
      return;
    }
    resetFlow();
  }

  const loadingStep =
    state.step === "analyzing" || state.step === "matching"
      ? (state.step as NaturalLoadingStepName)
      : null;

  return (
    <div
      className="choice-stepper-page flex min-h-dvh flex-col"
      data-natural-flow-step={state.step}
    >
      <NaturalRecommendationNav
        dirty={Boolean(state.input.trim())}
        onReset={confirmAndReset}
      />

      {state.step === "input" ? (
        <NaturalInputStep
          value={state.input}
          error={state.error}
          onChange={(value) => dispatch({ type: "SET_INPUT", value })}
          onSubmit={submitInput}
        />
      ) : null}

      {state.step === "clarify_age" ? (
        <NaturalAgeStep
          familyType={state.familyType}
          childAge={state.childAge}
          error={state.error}
          onFamilyTypeChange={(value) =>
            dispatch({ type: "SET_FAMILY_TYPE", value })
          }
          onChildAgeChange={(value) => dispatch({ type: "SET_CHILD_AGE", value })}
          onPrevious={() => dispatch({ type: "SHOW_INPUT" })}
          onSubmit={submitClarification}
        />
      ) : null}

      {loadingStep ? <NaturalLoadingStep step={loadingStep} /> : null}

      {state.step === "result" && state.response && state.interpretation ? (
        <NaturalRecommendationResult
          response={state.response}
          interpretation={state.interpretation}
          deciding={state.deciding}
          decisionError={state.decisionError}
          onDecision={(decision) => void decideApproval(decision)}
          onSameConditions={() =>
            void startRecommendation(
              requiresAgeClarification(state.input)
                ? {
                    familyType: state.familyType ?? "ADULTS",
                    childAge:
                      state.familyType === "KIDS" ? state.childAge : null,
                  }
                : undefined,
            )
          }
          onEditInput={() => {
            cancelActiveRequest();
            dispatch({ type: "SHOW_INPUT" });
          }}
          onReset={resetFlow}
        />
      ) : null}
    </div>
  );
}
