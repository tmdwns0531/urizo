import type {
  AgentTraceRepository,
  DemoResettable,
} from "../../contracts/mvp-ports";
import type {
  NewTraceEvent,
  StoredTraceEvent,
} from "../../contracts/mvp-recommendation";
import { createId } from "../shared/id";
import { clone } from "./clone";

export class MemoryTraceRepository
  implements AgentTraceRepository, DemoResettable
{
  private readonly events = new Map<string, StoredTraceEvent[]>();

  appendManyForUnitOfWork(
    runId: string,
    events: readonly NewTraceEvent[],
  ): StoredTraceEvent[] {
    const runEvents = clone(this.events.get(runId) ?? []);
    const stored = events.map((event, index): StoredTraceEvent => ({
      ...clone(event),
      id: createId("trace"),
      runId,
      sequence: runEvents.length + index + 1,
      createdAt: new Date().toISOString(),
    }));
    this.events.set(runId, [...runEvents, ...stored]);
    return clone(stored);
  }

  async append(
    runId: string,
    event: NewTraceEvent,
  ): Promise<StoredTraceEvent> {
    return this.appendManyForUnitOfWork(runId, [event])[0];
  }

  async listStored(runId: string): Promise<StoredTraceEvent[]> {
    return this.snapshotForUnitOfWork(runId);
  }

  snapshotForUnitOfWork(runId: string): StoredTraceEvent[] {
    return clone(this.events.get(runId) ?? []);
  }

  restoreForUnitOfWork(
    runId: string,
    snapshot: readonly StoredTraceEvent[],
  ): void {
    if (snapshot.length > 0) this.events.set(runId, clone([...snapshot]));
    else this.events.delete(runId);
  }

  async clearForDemo(): Promise<void> {
    this.events.clear();
  }
}