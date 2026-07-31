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
} from "../../contracts/mvp-search";
import type { CatalogRepository } from "../../contracts/ports";
import { getMvpFilterReasons } from "../catalog/filtering";
import type { MvpRecommendationExecutor } from "./executors/types";
import { PolicyLayer, type MvpPolicyResult } from "./policy";
import { createInputFingerprint } from "../search/semantic";
import { resolveMvpRecommendationRequest } from "./request";
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
    });
    const runId = createId("run");
    const startedAt = new Date().toISOString();
    const invocation: RecommendationSearchInvocation = {
      kind: "initial",
      input: resolved.transientInput,
    };
    const runningRun: StoredRecommendationRun = {
      id: runId,
      status: "RUNNING",
      revision: 0,
      executionMode: null,
      inputFingerprint: null,
      requestSnapshot: resolved.sanitizedInput,
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
      !isMaterializedStoredRecommendationRun(run)
    ) {
      throw new RecommendationRunStateError(
        "The recommendation run is not ready for public access.",
      );
    }
    return {
      ...run.responseSnapshot,
      trace: await readPublicTrace(this.dependencies.traces, runId),
    } as MvpRecommendationResponse;
  }
  async decideApproval(
    runId: string,
    decision: MvpApprovalDecision,
  ): Promise<MvpRecommendationResponse> {
    const run = await this.requireRun(runId);
    if (
      run.status !== "AWAITING_APPROVAL" ||
      run.responseSnapshot?.status !== "awaiting_approval" ||
      !isMaterializedStoredRecommendationRun(run)
    ) {
      throw new RecommendationRunStateError(
        "The recommendation run is not waiting for approval.",
      );
    }

    if (decision === "reject") {
      const now = new Date().toISOString();
      const recommendations = run.responseSnapshot.partialRecommendations;
      const snapshot: StoredResponseSnapshot = {
        status: "completed",
        runId,
        recommendations,
        topPick: recommendations[0] ?? null,
        fallbackUsed: false,
        policyBlockedCount: run.policyBlockCount,
        notice: `30분 조건에 맞는 ${recommendations.length}편만 보여드려요.`,
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
          "30분 조건을 그대로 유지했어요",
          "조건을 넓히지 않고 현재 안전한 부분 결과로 추천을 마쳤습니다.",
          { effectiveRuntimeMinutes: 30, resultCount: recommendations.length },
        ),
        publicTrace(
          "complete",
          "부분 결과로 추천을 마쳤어요",
          `30분 조건을 지킨 ${recommendations.length}편을 보여드립니다.`,
          { resultCount: recommendations.length },
        ),
      ]);
      this.updatedRunOrThrow(updated);
      return this.getRequiredResponse(runId);
    }

    const approvedInput: SanitizedRecommendationSearchInput = {
      ...run.requestSnapshot,
      maxRuntimeMinutes: 45,
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
          "45분까지 넓혀 다시 찾았어요",
          "사용자가 승인한 runtime만 45분으로 바꾸고 나머지 조건은 유지했습니다.",
          { effectiveRuntimeMinutes: 45 },
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