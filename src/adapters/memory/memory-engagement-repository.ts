import type { EngagementRepository } from "../../contracts/ports";
import type {
  EngagementEvent,
  EngagementEventInput,
} from "../../contracts/engagement";
import { createId } from "../shared/id";
import { clone } from "./clone";

export class MemoryEngagementRepository implements EngagementRepository {
  private readonly events: EngagementEvent[] = [];

  async record(input: EngagementEventInput): Promise<EngagementEvent> {
    const event: EngagementEvent = {
      ...input,
      id: createId("engagement"),
      createdAt: new Date().toISOString(),
    };
    this.events.push(event);
    return clone(event);
  }

  async list(userId?: string): Promise<EngagementEvent[]> {
    return this.events
      .filter((event) => !userId || event.userId === userId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(clone);
  }

  async clear(): Promise<void> {
    this.events.splice(0, this.events.length);
  }
}
