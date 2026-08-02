import {
  readMvpAdapterConfig,
  validateSelectedMvpAdapters,
  type MvpAdapterConfig,
} from "../config/adapters";
import type { DemoResettable } from "../contracts/mvp-ports";
import { AgentRecommendationExecutor } from "../domains/recommendation/agent/agent-recommendation-executor";
import { AnonymousRecommendationOrchestrator } from "../domains/recommendation/orchestrator";
import { PolicyLayer } from "../domains/recommendation/policy";
import { createSearchCatalogTool } from "../domains/recommendation/tools/search-catalog-tool";
import { ToolRegistry } from "../domains/recommendation/tools/tool-registry";
import { createDemoAdapters, type DemoAdapterSet } from "./demo";
import { resolveMvpAdapters } from "./live";
import type {
  MvpAdapterOverrides,
  MvpComposition,
} from "./types";

type Environment = Record<string, string | undefined>;

export interface CreateMvpCompositionOptions {
  config?: MvpAdapterConfig;
  env?: Environment;
  overrides?: MvpAdapterOverrides;
  demoAdapters?: DemoAdapterSet;
}

function isDemoResettable(value: unknown): value is DemoResettable {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { clearForDemo?: unknown }).clearForDemo === "function"
  );
}

function usesPrisma(config: MvpAdapterConfig): boolean {
  return (
    config.catalog === "prisma" ||
    config.search === "pgvector" ||
    config.runStore === "prisma" ||
    config.traceStore === "prisma"
  );
}

export async function createMvpComposition(
  options: CreateMvpCompositionOptions = {},
): Promise<MvpComposition> {
  const env = options.env ?? process.env;
  const config = options.config ?? readMvpAdapterConfig(env);
  validateSelectedMvpAdapters(config, env);

  const demo = options.demoAdapters ?? createDemoAdapters();
  const resolved = await resolveMvpAdapters(
    config,
    demo,
    env,
    options.overrides,
  );
  const adapters = resolved.adapters;

  try {
    const tools = new ToolRegistry();
    tools.register(
      createSearchCatalogTool(adapters.catalog, adapters.search),
    );
    const executor = new AgentRecommendationExecutor(
      adapters.selector,
      tools,
      {
        executionMode:
          config.selector === "openai" ? "OPENAI" : "DETERMINISTIC",
      },
    );
    const policy = new PolicyLayer(adapters.catalog);
    const demoReset =
      config.appProfile === "demo" &&
      isDemoResettable(adapters.runs) &&
      isDemoResettable(adapters.traces)
        ? { runs: adapters.runs, traces: adapters.traces }
        : undefined;
    const services = new AnonymousRecommendationOrchestrator({
      appProfile: config.appProfile,
      catalog: adapters.catalog,
      executor,
      policy,
      runs: adapters.runs,
      traces: adapters.traces,
      persistence: resolved.persistence,
      ...(demoReset ? { demoReset } : {}),
    });

    return {
      adapters,
      services,
      dispose: resolved.dispose,
    };
  } catch (error) {
    await resolved.dispose();
    throw error;
  }
}

export const createComposition = createMvpComposition;

type CachedComposition = {
  key: string;
  promise: Promise<MvpComposition>;
};

type GlobalComposition = typeof globalThis & {
  __ottDamoaMvpComposition?: CachedComposition;
  __ottDamoaDemoAdapters?: DemoAdapterSet;
};

const globalComposition = globalThis as GlobalComposition;

function getSharedDemoAdapters(): DemoAdapterSet {
  if (!globalComposition.__ottDamoaDemoAdapters) {
    globalComposition.__ottDamoaDemoAdapters = createDemoAdapters();
  }
  return globalComposition.__ottDamoaDemoAdapters;
}

/**
 * Prisma-backed compositions are request-scoped because workerd TCP sockets
 * and pg pools must not cross request boundaries. Non-Prisma compositions are
 * safe to cache; shared memory Run/Trace stores remain stable across requests.
 */
export function getComposition(): Promise<MvpComposition> {
  const env = process.env;
  const config = readMvpAdapterConfig(env);
  const demoAdapters = getSharedDemoAdapters();
  if (usesPrisma(config)) {
    return createMvpComposition({ config, env, demoAdapters });
  }

  const key = JSON.stringify(config);
  const cached = globalComposition.__ottDamoaMvpComposition;
  if (cached?.key === key) {
    return cached.promise;
  }

  const entry: CachedComposition = {
    key,
    promise: createMvpComposition({ config, env, demoAdapters }),
  };
  entry.promise = entry.promise.catch((error) => {
    if (globalComposition.__ottDamoaMvpComposition === entry) {
      delete globalComposition.__ottDamoaMvpComposition;
    }
    throw error;
  });
  globalComposition.__ottDamoaMvpComposition = entry;
  return entry.promise;
}

export async function withMvpComposition<T>(
  operation: (composition: MvpComposition) => Promise<T>,
): Promise<T> {
  const composition = await getComposition();
  try {
    return await operation(composition);
  } finally {
    await composition.dispose();
  }
}

export type { MvpComposition } from "./types";
export type { AnonymousRecommendationServices } from "../contracts/mvp-recommendation";
export type {
  MvpApprovalDecision,
  MvpRecommendationResponse,
} from "../contracts/mvp-recommendation";
export type {
  MvpDemoRecommendationRequest,
  MvpRecommendationRequest,
} from "../contracts/mvp-search";
