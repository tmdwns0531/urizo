import type {
  DemoResettable,
  RecommendationRunRepository,
} from "../../contracts/mvp-ports";
import {
  assertStoredRecommendationRunState,
  type RunUpdateResult,
  type StoredRecommendationRun,
  type StoredRecommendationRunPatch,
} from "../../contracts/mvp-recommendation";
import { clone } from "./clone";

export class MemoryRunRepository
  implements RecommendationRunRepository, DemoResettable
{
  private readonly runs = new Map<string, StoredRecommendationRun>();

  createForUnitOfWork(run: StoredRecommendationRun): void {
    assertStoredRecommendationRunState(run);
    if (this.runs.has(run.id)) {
      throw new Error("A recommendation run with this ID already exists.");
    }
    this.runs.set(run.id, clone(run));
  }

  async create(run: StoredRecommendationRun): Promise<void> {
    this.createForUnitOfWork(run);
  }

  async get(runId: string): Promise<StoredRecommendationRun | null> {
    return this.snapshotForUnitOfWork(runId);
  }

  updateForUnitOfWork(
    runId: string,
    expectedRevision: number,
    patch: StoredRecommendationRunPatch,
  ): RunUpdateResult {
    const current = this.runs.get(runId);
    if (!current) {
      return { ok: false, reason: "NOT_FOUND" };
    }
    if (current.revision !== expectedRevision) {
      return { ok: false, reason: "REVISION_CONFLICT" };
    }

    const definedPatch = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as StoredRecommendationRunPatch;
    const updated: StoredRecommendationRun = {
      ...current,
      ...clone(definedPatch),
      id: current.id,
      revision: current.revision + 1,
      createdAt: current.createdAt,
    };
    assertStoredRecommendationRunState(updated);
    this.runs.set(runId, clone(updated));
    return { ok: true, run: clone(updated) };
  }

  async update(
    runId: string,
    expectedRevision: number,
    patch: StoredRecommendationRunPatch,
  ): Promise<RunUpdateResult> {
    return this.updateForUnitOfWork(runId, expectedRevision, patch);
  }

  snapshotForUnitOfWork(runId: string): StoredRecommendationRun | null {
    const run = this.runs.get(runId);
    return run ? clone(run) : null;
  }

  restoreForUnitOfWork(
    runId: string,
    snapshot: StoredRecommendationRun | null,
  ): void {
    if (snapshot) this.runs.set(runId, clone(snapshot));
    else this.runs.delete(runId);
  }

  async clearForDemo(): Promise<void> {
    this.runs.clear();
  }
}