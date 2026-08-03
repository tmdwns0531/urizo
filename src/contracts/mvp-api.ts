import type {
  ErrorResponse,
  MvpClarificationAnswer,
  MvpApprovalDecision,
  MvpCompletedRecommendationResponse,
  MvpRecommendationResponse,
} from "./mvp-recommendation";
import type {
  MvpDemoRecommendationRequest,
  MvpRecommendationRequest,
} from "./mvp-search";

export type ApprovalRequest =
  | { decision: MvpApprovalDecision }
  | {
      answer: MvpClarificationAnswer;
      naturalLanguage?: string;
    };

export interface ReplacementRequest {
  contentId: string;
}

export interface RunPathParameters {
  runId: string;
}

export type HealthStatus = "ok" | "degraded";
export type HealthMode = "demo" | "live";
export type AdapterHealthStatus =
  | "ok"
  | "unavailable"
  | "not_checked";

export interface HealthResponse {
  status: HealthStatus;
  mode: HealthMode;
  fullyDemo: boolean;
  fullyLive: boolean;
  adapters: {
    catalog: "fixture" | "prisma";
    search: "local" | "pgvector";
    selector: "deterministic" | "openai";
    runStore: "memory" | "prisma";
    traceStore: "memory" | "prisma";
  };
  adapterStatus: {
    catalog: AdapterHealthStatus;
    search: AdapterHealthStatus;
    selector: AdapterHealthStatus;
    runStore: AdapterHealthStatus;
    traceStore: AdapterHealthStatus;
  };
}

export interface DemoResetResponse {
  ok: true;
}

export const MVP_API_ENDPOINTS = {
  createRecommendation: {
    method: "POST",
    path: "/api/recommendations",
    successStatus: 201,
    errorStatuses: [400, 500],
  },
  getRecommendation: {
    method: "GET",
    path: "/api/recommendations/{runId}",
    successStatus: 200,
    errorStatuses: [404, 500],
  },
  decideApproval: {
    method: "POST",
    path: "/api/recommendations/{runId}/approval",
    successStatus: 200,
    errorStatuses: [400, 404, 500],
  },
  replaceRecommendation: {
    method: "POST",
    path: "/api/recommendations/{runId}/replacement",
    successStatus: 200,
    errorStatuses: [400, 404, 500],
  },
  health: {
    method: "GET",
    path: "/api/health",
    successStatus: 200,
    errorStatuses: [500],
  },
  resetDemo: {
    method: "POST",
    path: "/api/demo/reset",
    successStatus: 200,
    errorStatuses: [404, 500],
  },
} as const;

/**
 * Compile-time association between every public endpoint and its DTOs.
 * Path parameters are represented by the route path and are not request bodies.
 */
export interface MvpApiContract {
  createRecommendation: {
    params: undefined;
    request: MvpRecommendationRequest;
    response: MvpRecommendationResponse;
    error: ErrorResponse;
  };
  getRecommendation: {
    params: RunPathParameters;
    request: undefined;
    response: MvpRecommendationResponse;
    error: ErrorResponse;
  };
  decideApproval: {
    params: RunPathParameters;
    request: ApprovalRequest;
    response: MvpRecommendationResponse;
    error: ErrorResponse;
  };
  replaceRecommendation: {
    params: RunPathParameters;
    request: ReplacementRequest;
    response: MvpCompletedRecommendationResponse;
    error: ErrorResponse;
  };
  health: {
    params: undefined;
    request: undefined;
    response: HealthResponse;
    error: ErrorResponse;
  };
  resetDemo: {
    params: undefined;
    request: undefined;
    response: DemoResetResponse;
    error: ErrorResponse;
  };
}

/**
 * Demo Lab and automated tests may send the optional scenario discriminator.
 * Live HTTP validation uses MvpApiContract and rejects that extra field.
 */
export interface MvpDemoApiContract
  extends Omit<MvpApiContract, "createRecommendation"> {
  createRecommendation: Omit<
    MvpApiContract["createRecommendation"],
    "request"
  > & {
    request: MvpDemoRecommendationRequest;
  };
}
