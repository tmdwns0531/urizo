import type { CatalogContent } from "./catalog";
import type { Companion, OriginPreference } from "./search";

export const DEMO_SCENARIOS = [
  "normal",
  "approval",
  "policy_block",
  "budget_fallback",
] as const;
export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

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
  matchPercent: number;
  scoreBreakdown: ScoreBreakdown;
  reasons: string[];
  replacementOf?: string;
}

export interface ApprovalProposal {
  kind: "RUNTIME_RELAXATION";
  currentMaxMinutes: 30;
  proposedMaxMinutes: 45;
  currentCandidateCount: number;
  question: string;
  approveLabel: string;
  rejectLabel: string;
}

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
export type TraceAction = (typeof TRACE_ACTIONS)[number];

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

export interface CompletedRecommendationResponse extends ResponseBase {
  status: "completed";
  recommendations: RecommendationItem[];
  topPick: RecommendationItem | null;
  fallbackUsed: boolean;
  policyBlockedCount: number;
  notice?: string;
}

export interface AwaitingApprovalRecommendationResponse extends ResponseBase {
  status: "awaiting_approval";
  proposal: ApprovalProposal;
  partialRecommendations: RecommendationItem[];
  fallbackUsed: false;
  policyBlockedCount: number;
}

export type RecommendationResponse =
  | CompletedRecommendationResponse
  | AwaitingApprovalRecommendationResponse;

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
