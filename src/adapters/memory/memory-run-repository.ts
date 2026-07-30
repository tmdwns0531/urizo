import type { RunRepository } from "../../contracts/ports";
import type { RecommendationRun } from "../../contracts/recommendation";
import { clone } from "./clone";

export class MemoryRunRepository implements RunRepository {
  private readonly runs = new Map<string, RecommendationRun>();

  async save(run: RecommendationRun): Promise<void> {
    this.runs.set(run.id, clone(run));
  }

  async get(runId: string): Promise<RecommendationRun | null> {
    const run = this.runs.get(runId);
    return run ? clone(run) : null;
  }

  async list(userId?: string): Promise<RecommendationRun[]> {
    return [...this.runs.values()]
      .filter((run) => !userId || run.userId === userId)
      .sort((left, right) =>
        right.response.createdAt.localeCompare(left.response.createdAt),
      )
      .map(clone);
  }

  async clear(): Promise<void> {
    this.runs.clear();
  }
}
