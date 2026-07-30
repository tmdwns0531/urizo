import type {
  PublicTraceEvent,
  TraceAction,
} from "../../contracts/recommendation";
import type { TraceRepository } from "../../contracts/ports";

export interface TraceDetail {
  title: string;
  description: string;
  metrics?: Record<string, number | string | boolean>;
}

export class PublicTraceWriter {
  constructor(
    private readonly runId: string,
    private readonly repository: TraceRepository,
  ) {}

  async emit(
    action: TraceAction,
    detail: TraceDetail,
  ): Promise<PublicTraceEvent> {
    const current = await this.repository.list(this.runId);
    return this.repository.append(this.runId, {
      runId: this.runId,
      step: current.length + 1,
      action,
      title: detail.title,
      description: detail.description,
      createdAt: new Date().toISOString(),
      metrics: detail.metrics,
    });
  }

  list(): Promise<PublicTraceEvent[]> {
    return this.repository.list(this.runId);
  }
}
