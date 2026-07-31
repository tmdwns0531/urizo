import type { AgentTraceRepository } from "../../contracts/mvp-ports";
import type {
  NewTraceEvent,
  StoredTraceEvent,
} from "../../contracts/mvp-recommendation";
import { createId } from "../shared/id";
import { mapPrismaTrace } from "./mappers";
import {
  hasPrismaErrorCode,
  type PrismaPersistenceClient,
  PrismaRepositoryError,
} from "./types";

export class PrismaAgentTraceRepository
  implements AgentTraceRepository {
  constructor(private readonly client: PrismaPersistenceClient) {}

  async append(
    runId: string,
    event: NewTraceEvent,
  ): Promise<StoredTraceEvent> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const counter = await transaction.recommendationRun.update({
          where: { id: runId },
          data: {
            nextTraceSequence: {
              increment: 1,
            },
          },
          select: {
            nextTraceSequence: true,
          },
        });
        const sequence = counter.nextTraceSequence - 1;
        const stored = await transaction.agentTrace.create({
          data: {
            id: createId("trace"),
            runId,
            sequence,
            action: event.action,
            visibility: event.visibility,
            detail: structuredClone(event.detail),
            publicMessage: event.publicMessage,
            durationMs: event.durationMs,
          },
        });
        return mapPrismaTrace(stored);
      });
    } catch (error) {
      if (hasPrismaErrorCode(error, "P2025")) {
        throw new PrismaRepositoryError("RUN_NOT_FOUND");
      }
      throw error;
    }
  }

  async listStored(runId: string): Promise<StoredTraceEvent[]> {
    const records = await this.client.agentTrace.findMany({
      where: { runId },
      orderBy: { sequence: "asc" },
    });
    return records.map(mapPrismaTrace);
  }
}
