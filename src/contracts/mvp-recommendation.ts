import type { RecommendationItem } from "./recommendation";
import type {
  MvpDemoRecommendationRequest,
  MvpRecommendationRequest,
  InputFingerprint,
  QueryVectorSnapshot,
  RecommendationSearchContinuation,
  SanitizedRecommendationSearchInput,
} from "./mvp-search";

export const PUBLIC_ERROR_CODES = [
  "BAD_REQUEST",
  "NOT_FOUND",
  "INTERNAL_ERROR",
] as const;

export type PublicErrorCode = (typeof PUBLIC_ERROR_CODES)[number];

export interface ErrorResponse {
  error: string;
  code: PublicErrorCode;
}

export type PublicRecommendationStatus =
  | "completed"
  | "awaiting_approval";

export const RUN_LIFECYCLE_STATUSES = [
  "RUNNING",
  "AWAITING_APPROVAL",
  "COMPLETED",
  "FAILED",
] as const;

export type RunLifecycleStatus = (typeof RUN_LIFECYCLE_STATUSES)[number];

export const EXECUTION_MODES = [
  "DETERMINISTIC",
  "OPENAI",
  "FALLBACK",
] as const;

export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export const FALLBACK_REASONS = [
  "BUDGET_EXCEEDED",
  "MODEL_ERROR",
  "MODEL_TIMEOUT",
  "MODEL_INVALID_OUTPUT",
] as const;

export type FallbackReason = (typeof FALLBACK_REASONS)[number];

export interface BudgetSnapshot {
  modelCalls: number;
  toolCalls: number;
  tokens: number;
  elapsedMs: number;
}

export const MVP_BUDGET_LIMITS = {
  modelCalls: 3,
  toolCalls: 2,
  tokens: 8_000,
  elapsedMs: 25_000,
} as const;

export interface MvpApprovalProposal {
  kind: "RUNTIME_RELAXATION";
  currentMaxMinutes: 30;
  proposedMaxMinutes: 45;
  currentCandidateCount: number;
  question: string;
  approveLabel: string;
  rejectLabel: string;
}

export type MvpApprovalDecision = "approve" | "reject";

export const MVP_TRACE_ACTIONS = [
  "filter",
  "vector_search",
  "score",
  "select",
  "policy_block",
  "approval_request",
  "approval_decision",
  "fallback",
  "replacement",
  "complete",
] as const;

export type MvpTraceAction = (typeof MVP_TRACE_ACTIONS)[number];

export const TRACE_METRIC_KEYS = [
  "candidateCount",
  "eligibleCount",
  "resultCount",
  "blockedCount",
  "modelCalls",
  "toolCalls",
  "tokens",
  "durationMs",
  "effectiveRuntimeMinutes",
] as const;

export type TraceMetricKey = (typeof TRACE_METRIC_KEYS)[number];
export type TraceMetrics = Partial<Record<TraceMetricKey, number>>;

export interface SanitizedTraceDetail {
  title: string;
  description: string;
  metrics?: TraceMetrics;
}

interface NewTraceEventBase {
  action: MvpTraceAction;
  detail: SanitizedTraceDetail;
  durationMs: number | null;
}

export type NewTraceEvent =
  | (NewTraceEventBase & {
      visibility: "PUBLIC";
      publicMessage: string;
    })
  | (NewTraceEventBase & {
      visibility: "INTERNAL";
      publicMessage: string | null;
    });

export type StoredTraceEvent = NewTraceEvent & {
  id: string;
  runId: string;
  sequence: number;
  createdAt: string;
};

export interface MvpPublicTraceEvent {
  id: string;
  runId: string;
  step: number;
  action: MvpTraceAction;
  title: string;
  description: string;
  createdAt: string;
  metrics?: TraceMetrics;
}

interface MvpResponseBase {
  runId: string;
  policyBlockedCount: number;
  trace: MvpPublicTraceEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface MvpCompletedRecommendationResponse
  extends MvpResponseBase {
  status: "completed";
  recommendations: RecommendationItem[];
  topPick: RecommendationItem | null;
  fallbackUsed: boolean;
  notice?: string;
}

export interface MvpAwaitingApprovalRecommendationResponse
  extends MvpResponseBase {
  status: "awaiting_approval";
  proposal: MvpApprovalProposal;
  partialRecommendations: RecommendationItem[];
  fallbackUsed: false;
}

export type MvpRecommendationResponse =
  | MvpCompletedRecommendationResponse
  | MvpAwaitingApprovalRecommendationResponse;

export type StoredResponseSnapshot =
  | Omit<MvpCompletedRecommendationResponse, "trace">
  | Omit<MvpAwaitingApprovalRecommendationResponse, "trace">;

export interface SelectorOutput {
  selectedIds: string[];
  topPickReason?: string;
  tokenUsage: number;
}

export interface MvpRecommendationExecutionResult {
  ranked: RecommendationItem[];
  selected: RecommendationItem[];
  excludedContentIds: string[];
  eligibleCount: number;
  continuation: RecommendationSearchContinuation;
  executionMode: ExecutionMode;
  fallbackUsed: boolean;
  fallbackReason: FallbackReason | null;
  budgetSnapshot: BudgetSnapshot;
  durationMs: number;
  notice?: string;
}

export interface RuleBasedFallbackInput {
  eligibleCatalog: import("./catalog").CatalogContent[];
  searchInput: SanitizedRecommendationSearchInput;
  continuation: RecommendationSearchContinuation;
  excludedContentIds: string[];
}

export interface RuleBasedFallbackResult {
  ranked: RecommendationItem[];
  selected: RecommendationItem[];
  excludedContentIds: string[];
  eligibleCount: number;
}

/**
 * Persistence DTO shared by memory and Prisma repositories. Only sanitized
 * snapshots and numeric query-vector data can cross this boundary.
 */
export interface StoredRecommendationRun {
  id: string;
  status: RunLifecycleStatus;
  revision: number;
  executionMode: ExecutionMode | null;
  inputFingerprint: InputFingerprint | null;
  requestSnapshot: SanitizedRecommendationSearchInput;
  queryVector: QueryVectorSnapshot | null;
  responseSnapshot: StoredResponseSnapshot | null;
  excludedContentIds: string[];
  replacedContentIds: string[];
  candidateCount: number;
  resultCount: number;
  modelCallCount: number;
  toolCallCount: number;
  totalTokens: number;
  durationMs: number;
  policyBlockCount: number;
  fallbackReason: FallbackReason | null;
  errorCode: PublicErrorCode | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MaterializedStoredRecommendationRun =
  StoredRecommendationRun & {
    executionMode: ExecutionMode;
    inputFingerprint: InputFingerprint;
    queryVector: QueryVectorSnapshot;
  };

export function isMaterializedStoredRecommendationRun(
  run: StoredRecommendationRun,
): run is MaterializedStoredRecommendationRun {
  return (
    run.executionMode !== null &&
    run.inputFingerprint !== null &&
    run.queryVector !== null
  );
}

export function assertStoredRecommendationRunState(
  run: StoredRecommendationRun,
): void {
  const materialized = isMaterializedStoredRecommendationRun(run);

  if (run.status === "RUNNING") {
    if (
      run.responseSnapshot !== null ||
      run.errorCode !== null ||
      run.completedAt !== null
    ) {
      throw new TypeError("RUNNING recommendation state is invalid.");
    }
    return;
  }

  if (run.status === "AWAITING_APPROVAL") {
    if (
      !materialized ||
      run.responseSnapshot?.status !== "awaiting_approval" ||
      run.errorCode !== null ||
      run.completedAt !== null
    ) {
      throw new TypeError("AWAITING_APPROVAL recommendation state is invalid.");
    }
    return;
  }

  if (run.status === "COMPLETED") {
    if (
      !materialized ||
      run.responseSnapshot?.status !== "completed" ||
      run.errorCode !== null ||
      run.completedAt === null
    ) {
      throw new TypeError("COMPLETED recommendation state is invalid.");
    }
    return;
  }

  if (
    run.status !== "FAILED" ||
    run.responseSnapshot !== null ||
    run.errorCode === null ||
    !PUBLIC_ERROR_CODES.includes(run.errorCode) ||
    run.completedAt === null
  ) {
    throw new TypeError("FAILED recommendation state is invalid.");
  }
}
export type StoredRecommendationRunPatch = Partial<
  Omit<StoredRecommendationRun, "id" | "revision" | "createdAt">
>;

export type RunUpdateResult =
  | {
      ok: true;
      run: StoredRecommendationRun;
    }
  | {
      ok: false;
      reason: "NOT_FOUND" | "REVISION_CONFLICT";
    };

export interface AnonymousRecommendationServices {
  recommend(
    request?: MvpRecommendationRequest | MvpDemoRecommendationRequest,
  ): Promise<MvpRecommendationResponse>;
  getRun(runId: string): Promise<MvpRecommendationResponse | null>;
  decideApproval(
    runId: string,
    decision: MvpApprovalDecision,
  ): Promise<MvpRecommendationResponse>;
  replace(
    runId: string,
    contentId: string,
  ): Promise<MvpCompletedRecommendationResponse>;
  resetForDemo(): Promise<void>;
}
