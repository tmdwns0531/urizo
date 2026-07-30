import type { AdapterConfig } from "../config/adapters";
import type {
  AdapterOverrides,
  AdapterSet,
} from "./types";

const requireOverride = <K extends keyof AdapterSet>(
  key: K,
  overrides: AdapterOverrides,
  selectedName: string,
): AdapterSet[K] => {
  const adapter = overrides[key];
  if (!adapter) {
    throw new Error(
      `${key} adapter "${selectedName}" is selected but no implementation was supplied to createComposition().`,
    );
  }
  return adapter;
};

/**
 * Allows each team member to replace only their live adapter. Demo adapters
 * remain active for every other capability, so one unfinished integration does
 * not block the rest of the application.
 */
export function resolveAdapters(
  config: AdapterConfig,
  demo: AdapterSet,
  overrides: AdapterOverrides = {},
): AdapterSet {
  const profiles = overrides.profiles ?? demo.profiles;
  return {
    profiles,
    auth:
      config.auth === "demo"
        ? overrides.auth ?? demo.auth
        : requireOverride("auth", overrides, config.auth),
    catalog:
      config.catalog === "fixture"
        ? overrides.catalog ?? demo.catalog
        : requireOverride("catalog", overrides, config.catalog),
    search:
      config.search === "local"
        ? overrides.search ?? demo.search
        : requireOverride("search", overrides, config.search),
    selector:
      config.selector === "deterministic"
        ? overrides.selector ?? demo.selector
        : requireOverride("selector", overrides, config.selector),
    runs:
      config.runStore === "memory"
        ? overrides.runs ?? demo.runs
        : requireOverride("runs", overrides, config.runStore),
    traces:
      config.traceStore === "memory"
        ? overrides.traces ?? demo.traces
        : requireOverride("traces", overrides, config.traceStore),
    engagements:
      config.engagementStore === "memory"
        ? overrides.engagements ?? demo.engagements
        : requireOverride(
            "engagements",
            overrides,
            config.engagementStore,
          ),
  };
}
