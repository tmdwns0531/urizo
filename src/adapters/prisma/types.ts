import type {
  ExecutionMode,
  FallbackReason,
  MvpTraceAction,
  NewTraceEvent,
  PublicErrorCode,
  RunLifecycleStatus,
  SanitizedTraceDetail,
  StoredRecommendationRun,
} from "../../contracts/mvp-recommendation";

export interface PrismaRunRecord {
  id: string;
  status: RunLifecycleStatus;
  revision: number;
  nextTraceSequence: number;
  executionMode: ExecutionMode | null;
  inputFingerprint: string | null;
  requestSnapshot: unknown;
  queryVector: unknown | null;
  responseSnapshot: unknown | null;
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
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrismaTraceRecord {
  id: string;
  runId: string;
  sequence: number;
  action: MvpTraceAction;
  visibility: NewTraceEvent["visibility"];
  detail: SanitizedTraceDetail;
  publicMessage: string | null;
  durationMs: number | null;
  createdAt: Date;
}

export interface PrismaRunDelegate {
  create(args: {
    data: Record<string, unknown>;
  }): Promise<PrismaRunRecord>;
  findUnique(args: {
    where: { id: string };
  }): Promise<PrismaRunRecord | null>;
  updateMany(args: {
    where: { id: string; revision: number };
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
  update(args: {
    where: { id: string };
    data: { nextTraceSequence: { increment: number } };
    select: { nextTraceSequence: true };
  }): Promise<{ nextTraceSequence: number }>;
}

export interface PrismaTraceDelegate {
  create(args: {
    data: Record<string, unknown>;
  }): Promise<PrismaTraceRecord>;
  findMany(args: {
    where: { runId: string };
    orderBy: { sequence: "asc" };
  }): Promise<PrismaTraceRecord[]>;
}

export interface PrismaPersistenceTransaction {
  recommendationRun: PrismaRunDelegate;
  agentTrace: PrismaTraceDelegate;
}

export interface PrismaPersistenceClient
  extends PrismaPersistenceTransaction {
  $transaction<T>(
    operation: (transaction: PrismaPersistenceTransaction) => Promise<T>,
  ): Promise<T>;
}

export interface PrismaErrorShape {
  code?: unknown;
}

export function hasPrismaErrorCode(
  error: unknown,
  code: string,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as PrismaErrorShape).code === code
  );
}

export class PrismaRepositoryError extends Error {
  constructor(
    readonly code:
      | "RUN_ALREADY_EXISTS"
      | "RUN_NOT_FOUND"
      | "CATALOG_WRITE_FAILED"
      | "INVALID_VECTOR"
      | "ACCOUNT_CREATE_FAILED"
      | "ACCOUNT_LOOKUP_FAILED"
      | "WATCHLIST_LIST_FAILED"
      | "WATCHLIST_ADD_FAILED"
      | "WATCHLIST_REMOVE_FAILED"
      | "WATCHLIST_CLEAR_FAILED",
  ) {
    super(code);
    this.name = "PrismaRepositoryError";
  }
}

export type RunCreateData = Omit<
  StoredRecommendationRun,
  "createdAt" | "updatedAt"
> & {
  createdAt: Date;
  updatedAt: Date;
};
