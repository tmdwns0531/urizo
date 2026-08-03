"use client";

import { useEffect, useReducer, useRef } from "react";
import type {
  MvpApprovalDecision,
  MvpClarificationAnswer,
  MvpRecommendationResponse,
} from "../../contracts/mvp-recommendation";
import { toAnonymousAdContext } from "../advertising/sponsored-video-ad";
import { AppShell } from "../app-shell";
import { buildRecommendationRequest } from "../choice-stepper/choice-state";
import { NaturalInputStep } from "./natural-input-step";
import {
  buildNaturalRecommendationRequest,
  clarificationAnswerToNaturalFamily,
  interpretNaturalRequest,
  type NaturalInterpretation,
  type NaturalInterpretationOverrideChange,
  type NaturalInterpretationOverrides,
} from "./natural-language";
import {
  NaturalLoadingStep,
  type NaturalLoadingStepName,
} from "./natural-loading-step";
import { NaturalRecommendationNav } from "./natural-nav";
import { NaturalRecommendationResult } from "./natural-result";

export type NaturalFlowStep =
  | "input"
  | "analyzing"
  | "matching"
  | "result";

type NaturalFlowState = {
  step: NaturalFlowStep;
  input: string;
  overrides: NaturalInterpretationOverrides;
  interpretation: NaturalInterpretation | null;
  response: MvpRecommendationResponse | null;
  error: string;
  deciding: MvpApprovalDecision | MvpClarificationAnswer | null;
  decisionError: string;
};

type NaturalFlowAction =
  | { type: "SET_INPUT"; value: string }
  | { type: "SET_OVERRIDE"; change: NaturalInterpretationOverrideChange }
  | { type: "SHOW_INPUT" }
  | { type: "VALIDATION_ERROR"; value: string }
  | { type: "START_REQUEST"; interpretation: NaturalInterpretation }
  | { type: "SHOW_MATCHING" }
  | { type: "SHOW_RESULT"; response: MvpRecommendationResponse }
  | { type: "REQUEST_ERROR"; value: string }
  | {
      type: "START_DECISION";
      decision: MvpApprovalDecision | MvpClarificationAnswer;
    }
  | {
      type: "DECISION_RESULT";
      response: MvpRecommendationResponse;
      interpretation?: NaturalInterpretation;
    }
  | { type: "DECISION_ERROR"; value: string }
  | { type: "RESET" };

const INITIAL_NATURAL_FLOW_STATE: NaturalFlowState = {
  step: "input",
  input: "",
  overrides: {},
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
      return {
        ...state,
        input: action.value,
        overrides: {},
        error: "",
      };
    case "SET_OVERRIDE": {
      const overrides = { ...state.overrides };
      switch (action.change.dimension) {
        case "who":
          overrides.who = action.change.value;
          break;
        case "mediaType":
          overrides.mediaType = action.change.value;
          break;
        case "runtimeMinutes":
          overrides.runtimeMinutes = action.change.value;
          break;
        case "providers":
          overrides.providers = [...action.change.value];
          break;
        case "mood":
          overrides.mood = action.change.value;
          break;
        case "origin":
          overrides.origin = action.change.value;
          break;
        case "genres":
          overrides.genres = [...action.change.value];
          break;
      }
      return { ...state, overrides, error: "" };
    }
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
        interpretation: action.interpretation ?? state.interpretation,
        deciding: null,
        decisionError: "",
      };
    case "DECISION_ERROR":
      return { ...state, deciding: null, decisionError: action.value };
    case "RESET":
      return INITIAL_NATURAL_FLOW_STATE;
  }
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

function isClarificationAnswer(
  value: MvpApprovalDecision | MvpClarificationAnswer,
): value is MvpClarificationAnswer {
  return value !== "approve" && value !== "reject";
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
    requestedOverrides: NaturalInterpretationOverrides = state.overrides,
  ) {
    const input = state.input.trim();
    const previousDraft = state.interpretation?.draft;
    const previousClarification =
      previousDraft?.familyType === "ADULTS" ||
      (previousDraft?.familyType === "KIDS" && previousDraft.childAge !== null)
        ? {
            familyType: previousDraft.familyType,
            childAge:
              previousDraft.familyType === "KIDS"
                ? previousDraft.childAge
                : null,
          }
        : undefined;
    let interpretation: NaturalInterpretation;
    try {
      interpretation = interpretNaturalRequest(
        input,
        previousClarification,
        requestedOverrides,
      );
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

    const matchingTimer = window.setTimeout(() => {
      if (isActive()) dispatch({ type: "SHOW_MATCHING" });
    }, 650);
    const outcome = await requestOutcome;
    window.clearTimeout(matchingTimer);
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
    void startRecommendation();
  }

  async function decideApproval(
    decision: MvpApprovalDecision | MvpClarificationAnswer,
  ) {
    const response = state.response;
    if (response?.status !== "awaiting_approval" || state.deciding) return;
    const clarificationAnswer = isClarificationAnswer(decision)
      ? decision
      : null;
    if (
      (response.proposal.kind === "FAMILY_COMPOSITION" &&
        clarificationAnswer === null) ||
      (response.proposal.kind === "RUNTIME_RELAXATION" &&
        clarificationAnswer !== null)
    ) {
      return;
    }
    dispatch({ type: "START_DECISION", decision });
    try {
      const request = await fetch(
        `/api/recommendations/${encodeURIComponent(response.runId)}/approval`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            clarificationAnswer
              ? {
                  answer: clarificationAnswer,
                  naturalLanguage: state.input.trim(),
                }
              : { decision },
          ),
        },
      );
      const result = await readRecommendationResponse(request);
      const interpretation =
        clarificationAnswer
          ? interpretNaturalRequest(
              state.input,
              clarificationAnswerToNaturalFamily(clarificationAnswer),
              state.overrides,
            )
          : undefined;
      dispatch({
        type: "DECISION_RESULT",
        response: result,
        ...(interpretation ? { interpretation } : {}),
      });
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
  let inputInterpretation: NaturalInterpretation | null = null;
  if (state.step === "input" && state.input.trim()) {
    try {
      inputInterpretation = interpretNaturalRequest(
        state.input,
        undefined,
        state.overrides,
      );
    } catch {
      inputInterpretation = null;
    }
  }

  return (
    <AppShell
      className="choice-stepper-page"
      header={
        <NaturalRecommendationNav
          dirty={Boolean(state.input.trim())}
          onReset={confirmAndReset}
        />
      }
      contentAsMain={false}
      naturalFlowStep={state.step}
    >
      {state.step === "input" ? (
        <NaturalInputStep
          value={state.input}
          interpretation={inputInterpretation}
          overrides={state.overrides}
          error={state.error}
          onChange={(value) => dispatch({ type: "SET_INPUT", value })}
          onOverrideChange={(change) =>
            dispatch({ type: "SET_OVERRIDE", change })
          }
          onSubmit={submitInput}
        />
      ) : null}

      {loadingStep ? (
        <NaturalLoadingStep
          step={loadingStep}
          context={
            state.interpretation
              ? toAnonymousAdContext(
                  buildRecommendationRequest(state.interpretation.draft).choice,
                )
              : undefined
          }
        />
      ) : null}

      {state.step === "result" && state.response && state.interpretation ? (
        <NaturalRecommendationResult
          response={state.response}
          interpretation={state.interpretation}
          deciding={state.deciding}
          decisionError={state.decisionError}
          onDecision={(decision) => void decideApproval(decision)}
          onResponseChange={(response) =>
            dispatch({ type: "SHOW_RESULT", response })
          }
          onAllowAnyMediaType={() => {
            const overrides: NaturalInterpretationOverrides = {
              ...state.overrides,
              mediaType: "ANY",
            };
            dispatch({
              type: "SET_OVERRIDE",
              change: { dimension: "mediaType", value: "ANY" },
            });
            void startRecommendation(overrides);
          }}
          onEditInput={() => {
            cancelActiveRequest();
            dispatch({ type: "SHOW_INPUT" });
          }}
          onReset={resetFlow}
        />
      ) : null}
    </AppShell>
  );
}
