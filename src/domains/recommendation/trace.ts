import type { AgentTraceRepository } from "../../contracts/mvp-ports";
import {
  TRACE_METRIC_KEYS,
  type MvpPublicTraceEvent,
  type NewTraceEvent,
  type StoredTraceEvent,
} from "../../contracts/mvp-recommendation";

const metricKeys = new Set<string>(TRACE_METRIC_KEYS);

export function assertSanitizedTraceEvent(event: NewTraceEvent): void {
  if (!event.detail.title.trim() || !event.detail.description.trim()) {
    throw new Error("Trace title and description must not be empty.");
  }
  if (event.visibility === "PUBLIC" && !event.publicMessage.trim()) {
    throw new Error("Public Trace events require a public message.");
  }
  for (const [key, value] of Object.entries(event.detail.metrics ?? {})) {
    if (
      !metricKeys.has(key) ||
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0
    ) {
      throw new Error("Trace metrics must use finite non-negative allowlisted values.");
    }
  }
}

export async function appendTraceEvents(
  repository: AgentTraceRepository,
  runId: string,
  events: readonly NewTraceEvent[],
): Promise<StoredTraceEvent[]> {
  const stored: StoredTraceEvent[] = [];
  for (const event of events) {
    assertSanitizedTraceEvent(event);
    stored.push(await repository.append(runId, event));
  }
  return stored;
}

export function projectPublicTrace(
  events: readonly StoredTraceEvent[],
): MvpPublicTraceEvent[] {
  return events
    .filter(
      (event): event is StoredTraceEvent & {
        visibility: "PUBLIC";
        publicMessage: string;
      } => event.visibility === "PUBLIC" && Boolean(event.publicMessage),
    )
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => ({
      id: event.id,
      runId: event.runId,
      step: event.sequence,
      action: event.action,
      title: event.detail.title,
      description: event.publicMessage,
      createdAt: event.createdAt,
      ...(event.detail.metrics ? { metrics: event.detail.metrics } : {}),
    }));
}

export async function readPublicTrace(
  repository: AgentTraceRepository,
  runId: string,
): Promise<MvpPublicTraceEvent[]> {
  return projectPublicTrace(await repository.listStored(runId));
}