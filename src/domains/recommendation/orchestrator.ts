import { createId } from "../../adapters/shared/id";
import type {
  AgentTraceRepository,
  DemoResettable,
  RecommendationPersistenceUnitOfWork,
  RecommendationRunRepository,
} from "../../contracts/mvp-ports";
import {
  isMaterializedStoredRecommendationRun,
} from "../../contracts/mvp-recommendation";
import type {
  AnonymousRecommendationServices,
  MvpApprovalDecision,
  MvpClarificationAnswer,
  MvpCompletedRecommendationResponse,
  MvpRecommendationResponse,
  NewTraceEvent,
  StoredRecommendationRun,
  StoredResponseSnapshot,
} from "../../contracts/mvp-recommendation";
import type {
  MvpDemoRecommendationRequest,
  MvpRecommendationRequest,
  RecommendationSearchInvocation,
  SanitizedRecommendationSearchInput,
  TransientRecommendationSearchInput,
} from "../../contracts/mvp-search";
import { NATURAL_LANGUAGE_MAX_CODE_POINTS } from "../../contracts/mvp-search";
import type { CatalogRepository } from "../../contracts/ports";
import { getMvpFilterReasons } from "../catalog/filtering";
import type { MvpRecommendationExecutor } from "./executors/types";
import {
  createNoResultState,
  PolicyLayer,
  type MvpPolicyResult,
} from "./policy";
import { createInputFingerprint } from "../search/semantic";
import {
  resolveMvpRecommendationRequest,
  sanitizeMvpSearchInput,
} from "./request";
import { readPublicTrace } from "./trace";

interface AnonymousOrchestratorDependencies {
  appProfile: "demo" | "live";
  catalog: CatalogRepository;
  executor: MvpRecommendationExecutor;
  policy: PolicyLayer;
  runs: RecommendationRunRepository;
  traces: AgentTraceRepository;
  persistence: RecommendationPersistenceUnitOfWork;
  demoReset?: {
    runs: DemoResettable;
    traces: DemoResettable;
  };
}

const providerLabels: Record<
  SanitizedRecommendationSearchInput["selectedProviders"][number],
  string
> = {
  NETFLIX: "Netflix",
  TVING: "TVING",
  DISNEY_PLUS: "Disney+",
  WAVVE: "Wavve",
  WATCHA: "WATCHA",
  COUPANG_PLAY: "Coupang Play",
};

const companionLabels: Record<
  SanitizedRecommendationSearchInput["companions"][number],
  string
> = {
  ALONE: "혼자",
  PARTNER: "연인과",
  FRIENDS: "친구와",
  FAMILY: "가족과",
  WITH_CHILDREN: "아이와",
  ANY: "동반자 제한 없음",
};

/** Public copy made only from the persistence-safe CHOICE snapshot. */
export function formatRecommendationConditionSummary(
  input: SanitizedRecommendationSearchInput,
): string {
  const providers =
    input.selectedProviders.length === Object.keys(providerLabels).length
      ? "모든 OTT"
      : input.selectedProviders.map((provider) => providerLabels[provider]).join(", ");
  const runtime = input.maxRuntimeMinutes
    ? `${input.maxRuntimeMinutes}분 이내`
    : "시간 제한 없음";
  const childRating =
    input.companions.includes("WITH_CHILDREN") && input.childAgeRatingLimit
      ? input.childAgeRatingLimit === "ALL"
        ? "전체 관람가"
        : `${input.childAgeRatingLimit}세 관람가까지`
      : "";
  const mediaType =
    input.mediaType === "MOVIE"
      ? "영화"
      : input.mediaType === "SERIES"
        ? "시리즈"
        : "작품 유형 제한 없음";
  const parts = [
    companionLabels[input.companions[0] ?? "ANY"],
    mediaType,
    childRating,
    providers,
    runtime,
    ...input.moods,
    ...(input.requiredGenres ?? [])
      .slice(0, 2)
      .map((genre) => `${genre} 필수`),
    ...(input.excludedGenres ?? [])
      .slice(0, 2)
      .map((genre) => `${genre} 제외`),
    ...input.desiredGenres.slice(0, 2),
    input.originPreference === "KR"
      ? "한국 작품"
      : input.originPreference === "NON_KR"
        ? "해외 작품"
        : "",
  ];

  return parts.filter(Boolean).join(" · ");
}

function publicTrace(
  action: NewTraceEvent["action"],
  title: string,
  message: string,
  metrics?: NewTraceEvent["detail"]["metrics"],
): NewTraceEvent {
  return {
    action,
    visibility: "PUBLIC",
    publicMessage: message,
    detail: {
      title,
      description: message,
      ...(metrics ? { metrics } : {}),
    },
    durationMs: null,
  };
}

function responseSnapshot(
  runId: string,
  createdAt: string,
  updatedAt: string,
  result: MvpPolicyResult,
): StoredResponseSnapshot {
  if (result.status === "awaiting_approval") {
    return {
      status: "awaiting_approval",
      runId,
      proposal: result.proposal,
      partialRecommendations: result.partialRecommendations,
      fallbackUsed: false,
      policyBlockedCount: result.policyBlockedCount,
      createdAt,
      updatedAt,
    };
  }
  return {
    status: "completed",
    runId,
    recommendations: result.recommendations,
    topPick: result.recommendations[0] ?? null,
    fallbackUsed: result.execution.fallbackUsed,
    policyBlockedCount: result.policyBlockedCount,
    ...(result.noResult ? { noResult: result.noResult } : {}),
    ...(result.notice ? { notice: result.notice } : {}),
    createdAt,
    updatedAt,
  };
}

export class AnonymousRecommendationOrchestrator
  implements AnonymousRecommendationServices
{
  constructor(private readonly dependencies: AnonymousOrchestratorDependencies) {}

  async recommend(
    request: MvpRecommendationRequest | MvpDemoRecommendationRequest = {},
  ): Promise<MvpRecommendationResponse> {
    const resolved = resolveMvpRecommendationRequest(request, {
      allowScenario: this.dependencies.appProfile === "demo",
      requireMeaningfulChoice: true,
    });
    const runId = createId("run");
    const startedAt = new Date().toISOString();
    const preparation = this.dependencies.executor.prepareInitial?.(
      resolved.transientInput,
    ) ?? {
      input: resolved.transientInput,
      clarification: null,
    };
    const structuredInput = preparation.input;
    const structuredSanitizedInput = sanitizeMvpSearchInput(structuredInput);
    const invocation: RecommendationSearchInvocation = {
      kind: "initial",
      input: structuredInput,
    };
    const runningRun: StoredRecommendationRun = {
      id: runId,
      status: "RUNNING",
      revision: 0,
      executionMode: null,
      inputFingerprint: null,
      requestSnapshot: structuredSanitizedInput,
      queryVector: null,
      responseSnapshot: null,
      excludedContentIds: [],
      replacedContentIds: [],
      candidateCount: 0,
      resultCount: 0,
      modelCallCount: 0,
      toolCallCount: 0,
      totalTokens: 0,
      durationMs: 0,
      policyBlockCount: 0,
      fallbackReason: null,
      errorCode: null,
      startedAt,
      completedAt: null,
      createdAt: startedAt,
      updatedAt: startedAt,
    };
    await this.dependencies.persistence.createRunWithTraceEvents(runningRun, []);

    try {
      const clarification = preparation.clarification;
      if (clarification) {
        const updatedAt = new Date().toISOString();
        const snapshot: StoredResponseSnapshot = {
          status: "awaiting_approval",
          runId,
          proposal: clarification,
          partialRecommendations: [],
          fallbackUsed: false,
          policyBlockedCount: 0,
          createdAt: startedAt,
          updatedAt,
        };
        const updated =
          await this.dependencies.persistence.updateRunWithTraceEvents(
            runId,
            runningRun.revision,
            {
              status: "AWAITING_APPROVAL",
              requestSnapshot: structuredSanitizedInput,
              responseSnapshot: snapshot,
              updatedAt,
            },
            [
              publicTrace(
                "approval_request",
                "제한형 Agent가 모호한 조건을 확인해요",
                clarification.question,
                { toolCalls: 0 },
              ),
            ],
          );
        this.updatedRunOrThrow(updated);
        return this.getRequiredResponse(runId);
      }

      const result = await this.dependencies.policy.execute(
        runId,
        invocation,
        this.dependencies.executor,
        resolved.scenario ?? "normal",
        "configured",
      );
      const updatedAt = new Date().toISOString();
      const snapshot = responseSnapshot(runId, startedAt, updatedAt, result);
      const execution = result.execution;
      const updated = await this.dependencies.persistence.updateRunWithTraceEvents(
        runId,
        runningRun.revision,
        {
          status:
            result.status === "awaiting_approval"
              ? "AWAITING_APPROVAL"
              : "COMPLETED",
          executionMode: execution.executionMode,
          inputFingerprint: execution.continuation.inputFingerprint,
          queryVector: execution.continuation.queryVector,
          responseSnapshot: snapshot,
          excludedContentIds: execution.excludedContentIds,
          candidateCount: execution.ranked.length,
          resultCount:
            result.status === "completed"
              ? result.recommendations.length
              : result.partialRecommendations.length,
          modelCallCount: execution.budgetSnapshot.modelCalls,
          toolCallCount: execution.budgetSnapshot.toolCalls,
          totalTokens: execution.budgetSnapshot.tokens,
          durationMs: execution.durationMs,
          policyBlockCount: result.policyBlockedCount,
          fallbackReason: execution.fallbackReason,
          errorCode: null,
          completedAt: result.status === "completed" ? updatedAt : null,
          updatedAt,
        },
        result.traceEvents,
      );
      this.updatedRunOrThrow(updated);
      return this.getRequiredResponse(runId);
    } catch (error) {
      await this.recordFailureWithoutMasking(
        runId,
        runningRun.revision,
        startedAt,
        0,
      );
      throw error;
    }
  }
  async getRun(runId: string): Promise<MvpRecommendationResponse | null> {
    const run = await this.dependencies.runs.get(runId);
    if (!run) return null;
    if (run.status === "FAILED") {
      throw new RecommendationRunStateError(
        "The recommendation run failed safely.",
      );
    }
    if (
      run.status === "RUNNING" ||
      !run.responseSnapshot ||
      (!isMaterializedStoredRecommendationRun(run) &&
        !(
          run.status === "AWAITING_APPROVAL" &&
          run.responseSnapshot.status === "awaiting_approval" &&
          run.responseSnapshot.proposal.kind === "FAMILY_COMPOSITION"
        ))
    ) {
      throw new RecommendationRunStateError(
        "The recommendation run is not ready for public access.",
      );
    }
    return {
      ...run.responseSnapshot,
      conditionSummary: formatRecommendationConditionSummary(
        run.requestSnapshot,
      ),
      trace: await readPublicTrace(this.dependencies.traces, runId),
    } as MvpRecommendationResponse;
  }
  async decideApproval(
    runId: string,
    decision: MvpApprovalDecision | MvpClarificationAnswer,
    naturalLanguage = "",
  ): Promise<MvpRecommendationResponse> {
    const run = await this.requireRun(runId);
    if (
      run.status !== "AWAITING_APPROVAL" ||
      run.responseSnapshot?.status !== "awaiting_approval"
    ) {
      throw new RecommendationRunStateError(
        "The recommendation run is not waiting for approval.",
      );
    }

    if (run.responseSnapshot.proposal.kind === "FAMILY_COMPOSITION") {
      if (decision === "approve" || decision === "reject") {
        throw new RecommendationRunStateError(
          "The clarification response is invalid.",
        );
      }
      return this.continueAfterFamilyClarification(
        run,
        decision,
        naturalLanguage,
      );
    }

    if (
      !isMaterializedStoredRecommendationRun(run) ||
      (decision !== "approve" && decision !== "reject")
    ) {
      throw new RecommendationRunStateError(
        "The runtime approval response is invalid.",
      );
    }
    const runtimeProposal = run.responseSnapshot.proposal;

    if (decision === "reject") {
      const now = new Date().toISOString();
      const recommendations = run.responseSnapshot.partialRecommendations;
      const noResult =
        recommendations.length === 0
          ? createNoResultState(run.requestSnapshot)
          : undefined;
      const snapshot: StoredResponseSnapshot = {
        status: "completed",
        runId,
        recommendations,
        topPick: recommendations[0] ?? null,
        fallbackUsed: false,
        policyBlockedCount: run.policyBlockCount,
        ...(noResult ? { noResult } : {}),
        notice:
          noResult?.message ??
          `${runtimeProposal.currentMaxMinutes}분 조건에 맞는 ${recommendations.length}편만 보여드려요.`,
        createdAt: run.createdAt,
        updatedAt: now,
      };
      const updated = await this.dependencies.persistence.updateRunWithTraceEvents(runId, run.revision, {
        status: "COMPLETED",
        responseSnapshot: snapshot,
        resultCount: recommendations.length,
        completedAt: now,
        updatedAt: now,
      }, [
        publicTrace(
          "approval_decision",
          `${runtimeProposal.currentMaxMinutes}분 조건을 그대로 유지했어요`,
          "조건을 넓히지 않고 현재 안전한 부분 결과로 추천을 마쳤습니다.",
          {
            effectiveRuntimeMinutes: runtimeProposal.currentMaxMinutes,
            resultCount: recommendations.length,
          },
        ),
        publicTrace(
          "complete",
          "부분 결과로 추천을 마쳤어요",
          `${runtimeProposal.currentMaxMinutes}분 조건을 지킨 ${recommendations.length}편을 보여드립니다.`,
          { resultCount: recommendations.length },
        ),
      ]);
      this.updatedRunOrThrow(updated);
      return this.getRequiredResponse(runId);
    }

    const approvedInput: SanitizedRecommendationSearchInput = {
      ...run.requestSnapshot,
      maxRuntimeMinutes: runtimeProposal.proposedMaxMinutes,
    };
    const approvedInputFingerprint = await createInputFingerprint(
      approvedInput,
      run.queryVector,
    );
    const transitionedAt = new Date().toISOString();
    const transition = await this.dependencies.persistence.updateRunWithTraceEvents(
      runId,
      run.revision,
      {
        status: "RUNNING",
        requestSnapshot: approvedInput,
        inputFingerprint: approvedInputFingerprint,
        responseSnapshot: null,
        errorCode: null,
        completedAt: null,
        updatedAt: transitionedAt,
      },
      [
        publicTrace(
          "approval_decision",
          `${runtimeProposal.proposedMaxMinutes}분까지 넓혀 다시 찾았어요`,
          `사용자가 승인한 러닝타임만 ${runtimeProposal.proposedMaxMinutes}분으로 바꾸고 나머지 조건은 유지했습니다.`,
          { effectiveRuntimeMinutes: runtimeProposal.proposedMaxMinutes },
        ),
      ],
    );
    const runningRun = this.updatedRunOrThrow(transition);
    const invocation: RecommendationSearchInvocation = {
      kind: "continuation",
      input: approvedInput,
      continuation: {
        queryVector: run.queryVector,
        inputFingerprint: approvedInputFingerprint,
      },
    };

    try {
      const result = await this.dependencies.policy.execute(
        runId,
        invocation,
        this.dependencies.executor,
        "normal",
        "configured",
      );
      if (result.status !== "completed") {
        throw new RecommendationRunStateError(
          "An approved recommendation must complete without another approval.",
        );
      }
      const now = new Date().toISOString();
      const snapshot = responseSnapshot(runId, run.createdAt, now, result);
      const execution = result.execution;
      const updated = await this.dependencies.persistence.updateRunWithTraceEvents(
        runId,
        runningRun.revision,
        {
          status: "COMPLETED",
          executionMode: execution.executionMode,
          requestSnapshot: approvedInput,
          inputFingerprint: execution.continuation.inputFingerprint,
          queryVector: execution.continuation.queryVector,
          responseSnapshot: snapshot,
          excludedContentIds: [
            ...new Set([
              ...run.excludedContentIds,
              ...execution.excludedContentIds,
            ]),
          ],
          candidateCount: execution.ranked.length,
          resultCount: result.recommendations.length,
          modelCallCount:
            run.modelCallCount + execution.budgetSnapshot.modelCalls,
          toolCallCount:
            run.toolCallCount + execution.budgetSnapshot.toolCalls,
          totalTokens: run.totalTokens + execution.budgetSnapshot.tokens,
          durationMs: run.durationMs + execution.durationMs,
          policyBlockCount:
            run.policyBlockCount + result.policyBlockedCount,
          fallbackReason: execution.fallbackReason,
          errorCode: null,
          completedAt: now,
          updatedAt: now,
        },
        result.traceEvents,
      );
      this.updatedRunOrThrow(updated);
      return this.getRequiredResponse(runId);
    } catch (error) {
      await this.recordFailureWithoutMasking(
        runId,
        runningRun.revision,
        transitionedAt,
        runningRun.durationMs,
      );
      throw error;
    }
  }

  private async continueAfterFamilyClarification(
    run: StoredRecommendationRun,
    answer: MvpClarificationAnswer,
    naturalLanguage: string,
  ): Promise<MvpRecommendationResponse> {
    const transientText = naturalLanguage.trim();
    if (Array.from(transientText).length > NATURAL_LANGUAGE_MAX_CODE_POINTS) {
      throw new RecommendationRunStateError(
        "The transient clarification context is invalid.",
      );
    }

    const resolveClarification =
      this.dependencies.executor.resolveFamilyClarification;
    if (!resolveClarification) {
      throw new RecommendationRunStateError(
        "The active executor cannot resolve an Agent clarification.",
      );
    }
    const transientInput: TransientRecommendationSearchInput =
      resolveClarification.call(
        this.dependencies.executor,
        {
          ...run.requestSnapshot,
          hasNaturalLanguage: transientText.length > 0,
          naturalLanguage: transientText,
        },
        answer,
      );
    const clarifiedInput = sanitizeMvpSearchInput(transientInput);
    const childRatingLabel =
      clarifiedInput.childAgeRatingLimit === "ALL"
        ? "전체 관람가"
        : clarifiedInput.childAgeRatingLimit
          ? `${clarifiedInput.childAgeRatingLimit}세 관람가까지`
          : null;
    const transitionedAt = new Date().toISOString();
    const transition =
      await this.dependencies.persistence.updateRunWithTraceEvents(
        run.id,
        run.revision,
        {
          status: "RUNNING",
          requestSnapshot: clarifiedInput,
          responseSnapshot: null,
          errorCode: null,
          completedAt: null,
          updatedAt: transitionedAt,
        },
        [
          publicTrace(
            "approval_decision",
            "추가 답변을 조건에 반영했어요",
            childRatingLabel
              ? `아이와 함께 보는 조건에 ${childRatingLabel} 기준을 적용하고 검색을 시작했어요.`
              : "성인 가족끼리 보는 조건으로 검색을 시작했어요.",
          ),
        ],
      );
    const runningRun = this.updatedRunOrThrow(transition);
    const invocation: RecommendationSearchInvocation = {
      kind: "initial",
      input: transientInput,
    };

    try {
      const result = await this.dependencies.policy.execute(
        run.id,
        invocation,
        this.dependencies.executor,
        "normal",
        "configured",
      );
      const now = new Date().toISOString();
      const snapshot = responseSnapshot(run.id, run.createdAt, now, result);
      const execution = result.execution;
      const updated =
        await this.dependencies.persistence.updateRunWithTraceEvents(
          run.id,
          runningRun.revision,
          {
            status:
              result.status === "awaiting_approval"
                ? "AWAITING_APPROVAL"
                : "COMPLETED",
            executionMode: execution.executionMode,
            requestSnapshot: clarifiedInput,
            inputFingerprint: execution.continuation.inputFingerprint,
            queryVector: execution.continuation.queryVector,
            responseSnapshot: snapshot,
            excludedContentIds: [
              ...new Set([
                ...run.excludedContentIds,
                ...execution.excludedContentIds,
              ]),
            ],
            candidateCount: execution.ranked.length,
            resultCount:
              result.status === "completed"
                ? result.recommendations.length
                : result.partialRecommendations.length,
            modelCallCount:
              run.modelCallCount + execution.budgetSnapshot.modelCalls,
            toolCallCount:
              run.toolCallCount + execution.budgetSnapshot.toolCalls,
            totalTokens: run.totalTokens + execution.budgetSnapshot.tokens,
            durationMs: run.durationMs + execution.durationMs,
            policyBlockCount:
              run.policyBlockCount + result.policyBlockedCount,
            fallbackReason: execution.fallbackReason,
            errorCode: null,
            completedAt: result.status === "completed" ? now : null,
            updatedAt: now,
          },
          result.traceEvents,
        );
      this.updatedRunOrThrow(updated);
      return this.getRequiredResponse(run.id);
    } catch (error) {
      await this.recordFailureWithoutMasking(
        run.id,
        runningRun.revision,
        transitionedAt,
        runningRun.durationMs,
      );
      throw error;
    }
  }

  async replace(
    runId: string,
    contentId: string,
  ): Promise<MvpCompletedRecommendationResponse> {
    const run = await this.requireRun(runId);
    if (
      run.status !== "COMPLETED" ||
      run.responseSnapshot?.status !== "completed" ||
      !isMaterializedStoredRecommendationRun(run)
    ) {
      throw new RecommendationRunStateError(
        "The recommendation run must be completed before replacement.",
      );
    }
    const index = run.responseSnapshot.recommendations.findIndex(
      (item) => item.content.id === contentId,
    );
    if (index < 0) {
      throw new RecommendationRunStateError(
        "The requested content is not part of this recommendation run.",
      );
    }

    const invocation: RecommendationSearchInvocation = {
      kind: "continuation",
      input: run.requestSnapshot,
      continuation: {
        queryVector: run.queryVector,
        inputFingerprint: run.inputFingerprint,
      },
    };
    const result = await this.dependencies.policy.execute(
      runId,
      invocation,
      this.dependencies.executor,
      "normal",
      "ranked",
    );
    if (result.status !== "completed") {
      throw new RecommendationRunStateError(
        "Replacement cannot open a new approval request.",
      );
    }
    const unavailable = new Set([
      ...run.responseSnapshot.recommendations.map((item) => item.content.id),
      ...run.replacedContentIds,
    ]);
    const replacement = result.execution.ranked.find(
      (item) =>
        !unavailable.has(item.content.id) &&
        getMvpFilterReasons(item.content, run.requestSnapshot).length === 0,
    );
    if (!replacement) {
      throw new RecommendationRunStateError(
        "No safe replacement is available for this recommendation run.",
      );
    }

    const recommendations = [...run.responseSnapshot.recommendations];
    recommendations[index] = { ...replacement, replacementOf: contentId };
    const now = new Date().toISOString();
    const snapshot: StoredResponseSnapshot = {
      ...run.responseSnapshot,
      recommendations,
      topPick: recommendations[0] ?? null,
      fallbackUsed:
        run.responseSnapshot.fallbackUsed || result.execution.fallbackUsed,
      policyBlockedCount:
        run.responseSnapshot.policyBlockedCount + result.policyBlockedCount,
      updatedAt: now,
    };
    const execution = result.execution;
    const updated = await this.dependencies.persistence.updateRunWithTraceEvents(runId, run.revision, {
      executionMode: execution.fallbackUsed ? "FALLBACK" : run.executionMode,
      responseSnapshot: snapshot,
      excludedContentIds: [
        ...new Set([...run.excludedContentIds, ...execution.excludedContentIds]),
      ],
      replacedContentIds: [...run.replacedContentIds, contentId],
      candidateCount: execution.ranked.length,
      resultCount: recommendations.length,
      modelCallCount: run.modelCallCount + execution.budgetSnapshot.modelCalls,
      toolCallCount: run.toolCallCount + execution.budgetSnapshot.toolCalls,
      totalTokens: run.totalTokens + execution.budgetSnapshot.tokens,
      durationMs: run.durationMs + execution.durationMs,
      policyBlockCount: run.policyBlockCount + result.policyBlockedCount,
      fallbackReason: execution.fallbackReason ?? run.fallbackReason,
      updatedAt: now,
    }, [
      ...result.traceEvents,
      publicTrace(
        "replacement",
        "같은 조건의 새 작품으로 교체했어요",
        "현재와 과거 노출 작품을 제외하고 필수 조건을 통과한 한 자리를 교체했습니다.",
        { resultCount: recommendations.length },
      ),
    ]);
    this.updatedRunOrThrow(updated);
    const response = await this.getRequiredResponse(runId);
    if (response.status !== "completed") {
      throw new RecommendationRunStateError(
        "A replacement response must remain completed.",
      );
    }
    return response;
  }

  async resetForDemo(): Promise<void> {
    if (
      this.dependencies.appProfile !== "demo" ||
      !this.dependencies.demoReset
    ) {
      throw new DemoResetUnavailableError();
    }
    await Promise.all([
      this.dependencies.demoReset.runs.clearForDemo(),
      this.dependencies.demoReset.traces.clearForDemo(),
    ]);
  }

  private async requireRun(runId: string): Promise<StoredRecommendationRun> {
    const run = await this.dependencies.runs.get(runId);
    if (!run) throw new RecommendationRunNotFoundError();
    return run;
  }

  private async getRequiredResponse(runId: string): Promise<MvpRecommendationResponse> {
    const response = await this.getRun(runId);
    if (!response) throw new RecommendationRunNotFoundError();
    return response;
  }

  private updatedRunOrThrow(
    result: Awaited<ReturnType<RecommendationRunRepository["update"]>>,
  ): StoredRecommendationRun {
    if (!result.ok) {
      if (result.reason === "NOT_FOUND") {
        throw new RecommendationRunNotFoundError();
      }
      throw new RecommendationRevisionConflictError();
    }
    return result.run;
  }

  private async recordFailureWithoutMasking(
    runId: string,
    expectedRevision: number,
    attemptStartedAt: string,
    previousDurationMs: number,
  ): Promise<void> {
    const completedAt = new Date().toISOString();
    const attemptDurationMs = Math.max(
      0,
      Date.parse(completedAt) - Date.parse(attemptStartedAt),
    );
    try {
      await this.dependencies.persistence.updateRunWithTraceEvents(
        runId,
        expectedRevision,
        {
          status: "FAILED",
          responseSnapshot: null,
          errorCode: "INTERNAL_ERROR",
          durationMs: previousDurationMs + attemptDurationMs,
          completedAt,
          updatedAt: completedAt,
        },
        [],
      );
    } catch {
      // Failure persistence must never replace the original sanitized error.
    }
  }
}

export class RecommendationRunNotFoundError extends Error {
  constructor() {
    super("The recommendation run was not found.");
    this.name = "RecommendationRunNotFoundError";
  }
}

export class RecommendationRunStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecommendationRunStateError";
  }
}

export class RecommendationRevisionConflictError extends Error {
  constructor() {
    super("The recommendation run was changed by another request.");
    this.name = "RecommendationRevisionConflictError";
  }
}

export class DemoResetUnavailableError extends Error {
  constructor() {
    super("Demo reset is unavailable for the selected adapters.");
    this.name = "DemoResetUnavailableError";
  }
}
