import { Prisma } from "../../generated/prisma-workerd/client";
import {
  assertStoredRecommendationRunState,
  type StoredRecommendationRun,
  type StoredRecommendationRunPatch,
  type StoredTraceEvent,
} from "../../contracts/mvp-recommendation";
import type {
  PrismaRunRecord,
  PrismaTraceRecord,
} from "./types";

function hasOwn(
  value: object,
  key: PropertyKey,
): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function nullableJsonWrite(value: unknown | null): unknown {
  return value === null ? Prisma.DbNull : structuredClone(value);
}

function toDate(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new TypeError(`${field} must be an ISO date-time`);
  }
  return parsed;
}

export function mapPrismaRun(
  record: PrismaRunRecord,
): StoredRecommendationRun {
  const run: StoredRecommendationRun = {
    id: record.id,
    status: record.status,
    revision: record.revision,
    executionMode: record.executionMode,
    inputFingerprint:
      record.inputFingerprint as StoredRecommendationRun["inputFingerprint"],
    requestSnapshot:
      structuredClone(record.requestSnapshot) as StoredRecommendationRun["requestSnapshot"],
    queryVector:
      record.queryVector === null
        ? null
        : structuredClone(
            record.queryVector,
          ) as StoredRecommendationRun["queryVector"],
    responseSnapshot:
      record.responseSnapshot === null
        ? null
        : structuredClone(
            record.responseSnapshot,
          ) as StoredRecommendationRun["responseSnapshot"],
    excludedContentIds: [...record.excludedContentIds],
    replacedContentIds: [...record.replacedContentIds],
    candidateCount: record.candidateCount,
    resultCount: record.resultCount,
    modelCallCount: record.modelCallCount,
    toolCallCount: record.toolCallCount,
    totalTokens: record.totalTokens,
    durationMs: record.durationMs,
    policyBlockCount: record.policyBlockCount,
    fallbackReason: record.fallbackReason,
    errorCode: record.errorCode,
    startedAt: record.startedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
  assertStoredRecommendationRunState(run);
  return run;
}

export function mapRunForCreate(
  run: StoredRecommendationRun,
): Record<string, unknown> {
  assertStoredRecommendationRunState(run);
  return {
    id: run.id,
    status: run.status,
    revision: run.revision,
    executionMode: run.executionMode,
    inputFingerprint: run.inputFingerprint,
    requestSnapshot: structuredClone(run.requestSnapshot),
    queryVector: nullableJsonWrite(run.queryVector),
    responseSnapshot: nullableJsonWrite(run.responseSnapshot),
    excludedContentIds: [...run.excludedContentIds],
    replacedContentIds: [...run.replacedContentIds],
    candidateCount: run.candidateCount,
    resultCount: run.resultCount,
    modelCallCount: run.modelCallCount,
    toolCallCount: run.toolCallCount,
    totalTokens: run.totalTokens,
    durationMs: run.durationMs,
    policyBlockCount: run.policyBlockCount,
    fallbackReason: run.fallbackReason,
    errorCode: run.errorCode,
    startedAt: toDate(run.startedAt, "startedAt"),
    completedAt:
      run.completedAt === null
        ? null
        : toDate(run.completedAt, "completedAt"),
    createdAt: toDate(run.createdAt, "createdAt"),
    updatedAt: toDate(run.updatedAt, "updatedAt"),
  };
}

export function mapRunPatch(
  patch: StoredRecommendationRunPatch,
): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const directKeys = [
    "status",
    "executionMode",
    "inputFingerprint",
    "candidateCount",
    "resultCount",
    "modelCallCount",
    "toolCallCount",
    "totalTokens",
    "durationMs",
    "policyBlockCount",
    "fallbackReason",
    "errorCode",
  ] as const;

  for (const key of directKeys) {
    if (hasOwn(patch, key) && patch[key] !== undefined) {
      data[key] = patch[key];
    }
  }

  const jsonKeys = [
    "requestSnapshot",
    "queryVector",
    "responseSnapshot",
  ] as const;
  for (const key of jsonKeys) {
    if (hasOwn(patch, key) && patch[key] !== undefined) {
      data[key] = nullableJsonWrite(patch[key] ?? null);
    }
  }

  const arrayKeys = [
    "excludedContentIds",
    "replacedContentIds",
  ] as const;
  for (const key of arrayKeys) {
    if (hasOwn(patch, key) && patch[key] !== undefined) {
      data[key] = [...patch[key]];
    }
  }

  if (hasOwn(patch, "startedAt") && patch.startedAt !== undefined) {
    data.startedAt = toDate(patch.startedAt, "startedAt");
  }
  if (hasOwn(patch, "completedAt") && patch.completedAt !== undefined) {
    data.completedAt =
      patch.completedAt === null
        ? null
        : toDate(patch.completedAt, "completedAt");
  }
  if (hasOwn(patch, "updatedAt") && patch.updatedAt !== undefined) {
    data.updatedAt = toDate(patch.updatedAt, "updatedAt");
  }

  return data;
}

export function mapPrismaTrace(
  record: PrismaTraceRecord,
): StoredTraceEvent {
  const common = {
    id: record.id,
    runId: record.runId,
    sequence: record.sequence,
    action: record.action,
    detail: structuredClone(record.detail),
    durationMs: record.durationMs,
    createdAt: record.createdAt.toISOString(),
  };

  if (record.visibility === "PUBLIC") {
    if (record.publicMessage === null) {
      throw new TypeError("PUBLIC Trace must have a publicMessage");
    }
    return {
      ...common,
      visibility: "PUBLIC",
      publicMessage: record.publicMessage,
    };
  }

  return {
    ...common,
    visibility: "INTERNAL",
    publicMessage: record.publicMessage,
  };
}
