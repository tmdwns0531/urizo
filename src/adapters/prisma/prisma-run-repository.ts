import type { RecommendationRunRepository } from "../../contracts/mvp-ports";
import type {
  RunUpdateResult,
  StoredRecommendationRun,
  StoredRecommendationRunPatch,
} from "../../contracts/mvp-recommendation";
import {
  mapPrismaRun,
  mapRunForCreate,
  mapRunPatch,
} from "./mappers";
import {
  hasPrismaErrorCode,
  type PrismaPersistenceClient,
  PrismaRepositoryError,
} from "./types";

export class PrismaRecommendationRunRepository
  implements RecommendationRunRepository {
  constructor(private readonly client: PrismaPersistenceClient) {}

  async create(run: StoredRecommendationRun): Promise<void> {
    try {
      await this.client.recommendationRun.create({
        data: mapRunForCreate(run),
      });
    } catch (error) {
      if (hasPrismaErrorCode(error, "P2002")) {
        throw new PrismaRepositoryError("RUN_ALREADY_EXISTS");
      }
      throw error;
    }
  }

  async get(runId: string): Promise<StoredRecommendationRun | null> {
    const record = await this.client.recommendationRun.findUnique({
      where: { id: runId },
    });
    return record ? mapPrismaRun(record) : null;
  }

  async update(
    runId: string,
    expectedRevision: number,
    patch: StoredRecommendationRunPatch,
  ): Promise<RunUpdateResult> {
    return this.client.$transaction(async (transaction) => {
      const result = await transaction.recommendationRun.updateMany({
        where: {
          id: runId,
          revision: expectedRevision,
        },
        data: {
          ...mapRunPatch(patch),
          revision: { increment: 1 },
        },
      });

      if (result.count === 0) {
        const existing = await transaction.recommendationRun.findUnique({
          where: { id: runId },
        });
        return existing
          ? { ok: false, reason: "REVISION_CONFLICT" }
          : { ok: false, reason: "NOT_FOUND" };
      }

      const updated = await transaction.recommendationRun.findUnique({
        where: { id: runId },
      });
      if (!updated) {
        throw new PrismaRepositoryError("RUN_NOT_FOUND");
      }
      return {
        ok: true,
        run: mapPrismaRun(updated),
      };
    });
  }
}
