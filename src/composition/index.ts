import {
  readAdapterConfig,
  validateSelectedLiveAdapters,
  type AdapterConfig,
} from "../config/adapters";
import { PipelineRecommendationExecutor } from "../domains/recommendation/executors/pipeline-recommendation-executor";
import {
  RecommendationOrchestrator,
  type RecommendationServices,
} from "../domains/recommendation/orchestrator";
import { PolicyLayer } from "../domains/recommendation/policy";
import { createDemoAdapters } from "./demo";
import { resolveAdapters } from "./live";
import type {
  AdapterOverrides,
  Composition,
} from "./types";

type Environment = Record<string, string | undefined>;

export function createComposition(
  options: {
    config?: AdapterConfig;
    env?: Environment;
    overrides?: AdapterOverrides;
  } = {},
): Composition {
  const config = options.config ?? readAdapterConfig(options.env);
  validateSelectedLiveAdapters(config, options.env);
  const adapters = resolveAdapters(
    config,
    createDemoAdapters(),
    options.overrides,
  );
  const executor = new PipelineRecommendationExecutor(
    adapters.catalog,
    adapters.search,
    adapters.selector,
  );
  const policy = new PolicyLayer(adapters.catalog);
  const services = new RecommendationOrchestrator({
    auth: adapters.auth,
    executor,
    policy,
    runs: adapters.runs,
    traces: adapters.traces,
    profiles: adapters.profiles,
    engagements: adapters.engagements,
  });

  return { adapters, services };
}

type GlobalComposition = typeof globalThis & {
  __ottDamoaComposition?: Composition;
};

const globalComposition = globalThis as GlobalComposition;

export const composition =
  globalComposition.__ottDamoaComposition ?? createComposition();

if (process.env.NODE_ENV !== "production") {
  globalComposition.__ottDamoaComposition = composition;
}

export const services: RecommendationServices = composition.services;

export type { RecommendationServices } from "../domains/recommendation/orchestrator";
export type {
  ApprovalDecision,
  RecommendationRequest,
  RecommendationResponse,
} from "../contracts/recommendation";
