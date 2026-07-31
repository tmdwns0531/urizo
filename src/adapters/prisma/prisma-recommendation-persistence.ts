import type { RecommendationPersistenceUnitOfWork } from "../../contracts/mvp-ports";
import type {
  NewTraceEvent,
  RunUpdateResult,
  StoredRecommendationRun,
  StoredRecommendationRunPatch,
} from "../../contracts/mvp-recommendation";
import { assertSanitizedTraceEvent } from "../../domains/recommendation/trace";
import { createId } from "../shared/id";
import { mapPrismaRun, mapRunForCreate, mapRunPatch } from "./mappers";
import {
  hasPrismaErrorCode,
  type PrismaPersistenceClient,
  type PrismaPersistenceTransaction,
  PrismaRepositoryError,
} from "./types";

function traceCreateData(runId: string, sequence: number, event: NewTraceEvent): Record<string, unknown> {
  return {
    id: createId("trace"),
    runId,
    sequence,
    action: event.action,
    visibility: event.visibility,
    detail: structuredClone(event.detail),
    publicMessage: event.publicMessage,
    durationMs: event.durationMs,
  };
}

async function insertTraceBatch(
  transaction: PrismaPersistenceTransaction,
  runId: string,
  firstSequence: number,
  events: readonly NewTraceEvent[],
): Promise<void> {
  for (const [index, event] of events.entries()) {
    await transaction.agentTrace.create({
      data: traceCreateData(runId, firstSequence + index, event),
    });
  }
}

/** Prisma transaction containing the Run create/CAS and its full Trace batch. */
export class PrismaRecommendationPersistenceUnitOfWork
  implements RecommendationPersistenceUnitOfWork
{
  constructor(private readonly client: PrismaPersistenceClient) {}

  async createRunWithTraceEvents(
    run: StoredRecommendationRun,
    events: readonly NewTraceEvent[],
  ): Promise<void> {
    events.forEach(assertSanitizedTraceEvent);
    try {
      await this.client.$transaction(async (transaction) => {
        await transaction.recommendationRun.create({
          data: { ...mapRunForCreate(run), nextTraceSequence: events.length + 1 },
        });
        await insertTraceBatch(transaction, run.id, 1, events);
      });
    } catch (error) {
      if (hasPrismaErrorCode(error, "P2002")) {
        throw new PrismaRepositoryError("RUN_ALREADY_EXISTS");
      }
      throw error;
    }
  }

  async updateRunWithTraceEvents(
    runId: string,
    expectedRevision: number,
    patch: StoredRecommendationRunPatch,
    events: readonly NewTraceEvent[],
  ): Promise<RunUpdateResult> {
    events.forEach(assertSanitizedTraceEvent);
    return this.client.$transaction(async (transaction) => {
      const result = await transaction.recommendationRun.updateMany({
        where: { id: runId, revision: expectedRevision },
        data: {
          ...mapRunPatch(patch),
          revision: { increment: 1 },
          ...(events.length > 0
            ? { nextTraceSequence: { increment: events.length } }
            : {}),
        },
      });
      if (result.count === 0) {
        const existing = await transaction.recommendationRun.findUnique({ where: { id: runId } });
        return existing
          ? { ok: false, reason: "REVISION_CONFLICT" }
          : { ok: false, reason: "NOT_FOUND" };
      }
      const updated = await transaction.recommendationRun.findUnique({ where: { id: runId } });
      if (!updated) throw new PrismaRepositoryError("RUN_NOT_FOUND");
      await insertTraceBatch(
        transaction,
        runId,
        updated.nextTraceSequence - events.length,
        events,
      );
      return { ok: true, run: mapPrismaRun(updated) };
    });
  }
}
