import type { RecommendationPersistenceUnitOfWork } from "../../contracts/mvp-ports";
import type {
  NewTraceEvent,
  RunUpdateResult,
  StoredRecommendationRun,
  StoredRecommendationRunPatch,
} from "../../contracts/mvp-recommendation";
import { assertSanitizedTraceEvent } from "../../domains/recommendation/trace";
import type { MemoryRunRepository } from "./memory-run-repository";
import type { MemoryTraceRepository } from "./memory-trace-repository";

/** Run state and its Trace batch are rolled back together on any failure. */
export class MemoryRecommendationPersistenceUnitOfWork
  implements RecommendationPersistenceUnitOfWork
{
  constructor(
    private readonly runs: MemoryRunRepository,
    private readonly traces: MemoryTraceRepository,
  ) {}

  async createRunWithTraceEvents(
    run: StoredRecommendationRun,
    events: readonly NewTraceEvent[],
  ): Promise<void> {
    events.forEach(assertSanitizedTraceEvent);
    const runBefore = this.runs.snapshotForUnitOfWork(run.id);
    const tracesBefore = this.traces.snapshotForUnitOfWork(run.id);
    try {
      this.runs.createForUnitOfWork(run);
      this.traces.appendManyForUnitOfWork(run.id, events);
    } catch (error) {
      this.runs.restoreForUnitOfWork(run.id, runBefore);
      this.traces.restoreForUnitOfWork(run.id, tracesBefore);
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
    const runBefore = this.runs.snapshotForUnitOfWork(runId);
    const tracesBefore = this.traces.snapshotForUnitOfWork(runId);
    try {
      const updated = this.runs.updateForUnitOfWork(runId, expectedRevision, patch);
      if (!updated.ok) return updated;
      this.traces.appendManyForUnitOfWork(runId, events);
      return updated;
    } catch (error) {
      this.runs.restoreForUnitOfWork(runId, runBefore);
      this.traces.restoreForUnitOfWork(runId, tracesBefore);
      throw error;
    }
  }
}
