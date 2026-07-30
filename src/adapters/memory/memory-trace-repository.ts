import type { TraceRepository } from "../../contracts/ports";
import type { PublicTraceEvent } from "../../contracts/recommendation";
import { createId } from "../shared/id";
import { clone } from "./clone";

export class MemoryTraceRepository implements TraceRepository {
  private readonly events = new Map<string, PublicTraceEvent[]>();

  async append(
    runId: string,
    event: Omit<PublicTraceEvent, "id">,
  ): Promise<PublicTraceEvent> {
    const stored: PublicTraceEvent = {
      ...event,
      id: createId("trace"),
    };
    const events = this.events.get(runId) ?? [];
    events.push(stored);
    this.events.set(runId, events);
    return clone(stored);
  }

  async list(runId: string): Promise<PublicTraceEvent[]> {
    return clone(this.events.get(runId) ?? []);
  }

  async clear(): Promise<void> {
    this.events.clear();
  }
}
