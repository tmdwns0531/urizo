import type { CatalogContent } from "./catalog";
import type { Companion, OriginPreference } from "./mvp-search";

export const DEMO_SCENARIOS = [
  "normal",
  "approval",
  "policy_block",
  "budget_fallback",
] as const;
/** @deprecated Use MvpDemoScenario from "./mvp-search". */
export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

/** @deprecated Use MvpRecommendationChoice from "./mvp-search". */
export interface RecommendationChoice {
  companions?: Companion[];
  moods?: string[];
  desiredGenres?: string[];
  companionAvoidGenres?: string[];
  maxRuntimeMinutes?: number | null;
  originPreference?: OriginPreference;
  naturalLanguage?: string;
  explicitlyRequestedGenres?: string[];
}

/** @deprecated Use MvpRecommendationRequest from "./mvp-search". */
export interface RecommendationRequest {
  /**
   * @deprecated Authentication identity is resolved server-side. This field is
   * retained only for adapter compatibility and ignored by the orchestrator.
   */
  userId?: string;
  choice?: RecommendationChoice;
  scenario?: DemoScenario;
}

export interface ScoreBreakdown {
  semantic: number;
  mood: number;
  genre: number;
  runtime: number;
  quality: number;
  companion: number;
  diversityPenalty: number;
  total: number;
}

export interface RecommendationItem {
  content: CatalogContent;
  score: number;
  matchPercent: number | null;
  scoreBreakdown: ScoreBreakdown;
  reasons: string[];
  replacementOf?: string;
}

/** @deprecated Use MvpApprovalProposal from "./mvp-recommendation". */
export interface ApprovalProposal {
  kind: "RUNTIME_RELAXATION";
  currentMaxMinutes: 30;
  proposedMaxMinutes: 45;
  currentCandidateCount: number;
  question: string;
  approveLabel: string;
  rejectLabel: string;
}

/** @deprecated Use MvpApprovalDecision from "./mvp-recommendation". */
export type ApprovalDecision = "approve" | "reject";

export const TRACE_ACTIONS = [
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
/** @deprecated Use MvpTraceAction from "./mvp-recommendation". */
export type TraceAction = (typeof TRACE_ACTIONS)[number];

/** @deprecated Use MvpPublicTraceEvent from "./mvp-recommendation". */
export interface PublicTraceEvent {
  id: string;
  runId: string;
  step: number;
  action: TraceAction;
  title: string;
  description: string;
  createdAt: string;
  metrics?: Record<string, number | string | boolean>;
}

interface ResponseBase {
  runId: string;
  createdAt: string;
  updatedAt: string;
  trace: PublicTraceEvent[];
}

/** @deprecated Use MvpCompletedRecommendationResponse from "./mvp-recommendation". */
export interface CompletedRecommendationResponse extends ResponseBase {
  status: "completed";
  recommendations: RecommendationItem[];
  topPick: RecommendationItem | null;
  fallbackUsed: boolean;
  policyBlockedCount: number;
  notice?: string;
}

/** @deprecated Use MvpAwaitingApprovalRecommendationResponse from "./mvp-recommendation". */
export interface AwaitingApprovalRecommendationResponse extends ResponseBase {
  status: "awaiting_approval";
  proposal: ApprovalProposal;
  partialRecommendations: RecommendationItem[];
  fallbackUsed: false;
  policyBlockedCount: number;
}

/** @deprecated Use MvpRecommendationResponse from "./mvp-recommendation". */
export type RecommendationResponse =
  | CompletedRecommendationResponse
  | AwaitingApprovalRecommendationResponse;

/** @deprecated Use StoredRecommendationRun from "./mvp-recommendation". */
export interface RecommendationRun {
  id: string;
  /** Authenticated owner of the run and all related engagement. */
  userId: string;
  /** Policy subject used by Demo scenarios without changing run ownership. */
  policySubjectUserId: string;
  request: RecommendationRequest;
  response: RecommendationResponse;
  excludedContentIds: string[];
  replacedContentIds: string[];
}
