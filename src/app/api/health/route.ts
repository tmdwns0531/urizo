import { withMvpComposition } from "@/composition";
import type {
  AdapterHealthStatus,
  HealthResponse,
} from "@/contracts/mvp-api";
import {
  isFullyMvpDemoConfig,
  isFullyMvpLiveConfig,
  readMvpAdapterConfig,
} from "@/config/adapters";
import { errorResponse } from "../_shared/http";

const HEALTH_PROBE_RUN_ID = "run_health_probe";

async function probe(
  operation: () => Promise<unknown>,
): Promise<AdapterHealthStatus> {
  try {
    await operation();
    return "ok";
  } catch {
    return "unavailable";
  }
}

export async function GET(): Promise<Response> {
  try {
    const config = readMvpAdapterConfig();
    const adapterStatus = await withMvpComposition(async ({ adapters }) => {
      const [catalog, runStore, traceStore] = await Promise.all([
        probe(() => adapters.catalog.list()),
        probe(() => adapters.runs.get(HEALTH_PROBE_RUN_ID)),
        probe(() => adapters.traces.listStored(HEALTH_PROBE_RUN_ID)),
      ]);
      return {
        catalog,
        search: config.search === "local" ? "ok" : "not_checked",
        selector:
          config.selector === "deterministic" ? "ok" : "not_checked",
        runStore,
        traceStore,
      } satisfies HealthResponse["adapterStatus"];
    });
    const body = {
      status: Object.values(adapterStatus).includes("unavailable")
        ? "degraded"
        : "ok",
      mode: config.appProfile,
      fullyDemo: isFullyMvpDemoConfig(config),
      fullyLive: isFullyMvpLiveConfig(config),
      adapters: {
        catalog: config.catalog,
        search: config.search,
        selector: config.selector,
        runStore: config.runStore,
        traceStore: config.traceStore,
      },
      adapterStatus,
    } satisfies HealthResponse;
    return Response.json(body);
  } catch (error) {
    return errorResponse(error);
  }
}