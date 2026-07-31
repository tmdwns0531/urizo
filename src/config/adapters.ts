export type AppProfile = "demo" | "live";
export type AuthAdapterName = "demo" | "authjs";
export type CatalogAdapterName = "fixture" | "prisma";
export type SearchAdapterName = "local" | "pgvector";
export type SelectorAdapterName = "deterministic" | "openai";
export type StoreAdapterName = "memory" | "prisma";

/** @deprecated Use MvpAdapterConfig for new anonymous MVP code. */
export interface AdapterConfig {
  appProfile: AppProfile;
  auth: AuthAdapterName;
  catalog: CatalogAdapterName;
  search: SearchAdapterName;
  selector: SelectorAdapterName;
  runStore: StoreAdapterName;
  traceStore: StoreAdapterName;
  engagementStore: StoreAdapterName;
}

export interface MvpAdapterConfig {
  appProfile: "demo" | "live";
  catalog: "fixture" | "prisma";
  search: "local" | "pgvector";
  selector: "deterministic" | "openai";
  runStore: "memory" | "prisma";
  traceStore: "memory" | "prisma";
}

export const MVP_DEMO_ADAPTER_CONFIG = {
  appProfile: "demo",
  catalog: "fixture",
  search: "local",
  selector: "deterministic",
  runStore: "memory",
  traceStore: "memory",
} as const satisfies MvpAdapterConfig;

export const MVP_LIVE_ADAPTER_CONFIG = {
  appProfile: "live",
  catalog: "prisma",
  search: "pgvector",
  selector: "openai",
  runStore: "prisma",
  traceStore: "prisma",
} as const satisfies MvpAdapterConfig;

export const MVP_DEFAULT_ADAPTER_CONFIG = MVP_DEMO_ADAPTER_CONFIG;

type Environment = Record<string, string | undefined>;

const choices = <T extends string>(
  value: string | undefined,
  fallback: T,
  allowed: readonly T[],
  name: string,
): T => {
  const selected = (value?.trim() || fallback) as T;
  if (!allowed.includes(selected)) {
    throw new Error(
      `${name} must be one of ${allowed.join(", ")}; received "${selected}".`,
    );
  }
  return selected;
};

export function readAdapterConfig(
  env: Environment = process.env,
): AdapterConfig {
  return {
    appProfile: choices(env.APP_PROFILE, "demo", ["demo", "live"], "APP_PROFILE"),
    auth: choices(env.AUTH_ADAPTER, "demo", ["demo", "authjs"], "AUTH_ADAPTER"),
    catalog: choices(
      env.CATALOG_ADAPTER,
      "fixture",
      ["fixture", "prisma"],
      "CATALOG_ADAPTER",
    ),
    search: choices(
      env.SEARCH_ADAPTER,
      "local",
      ["local", "pgvector"],
      "SEARCH_ADAPTER",
    ),
    selector: choices(
      env.SELECTOR_ADAPTER,
      "deterministic",
      ["deterministic", "openai"],
      "SELECTOR_ADAPTER",
    ),
    runStore: choices(
      env.RUN_STORE,
      "memory",
      ["memory", "prisma"],
      "RUN_STORE",
    ),
    traceStore: choices(
      env.TRACE_STORE,
      "memory",
      ["memory", "prisma"],
      "TRACE_STORE",
    ),
    engagementStore: choices(
      env.ENGAGEMENT_STORE,
      "memory",
      ["memory", "prisma"],
      "ENGAGEMENT_STORE",
    ),
  };
}

/**
 * Reads the v0.8 anonymous MVP selectors. The internal local-live override
 * deliberately ignores per-capability Demo selectors and selects the full LIVE preset.
 */
export function readMvpAdapterConfig(
  env: Environment = process.env,
): MvpAdapterConfig {
  const forceLivePreset =
    env.OTT_DAMOA_PROFILE_OVERRIDE?.trim() === "live";
  if (forceLivePreset) {
    return { ...MVP_LIVE_ADAPTER_CONFIG };
  }

  const appProfile = choices(
    env.APP_PROFILE,
    "demo",
    ["demo", "live"],
    "APP_PROFILE",
  );
  const defaults =
    appProfile === "live"
      ? MVP_LIVE_ADAPTER_CONFIG
      : MVP_DEMO_ADAPTER_CONFIG;
  const config = {
    appProfile,
    catalog: choices(
      env.CATALOG_ADAPTER,
      defaults.catalog,
      ["fixture", "prisma"],
      "CATALOG_ADAPTER",
    ),
    search: choices(
      env.SEARCH_ADAPTER,
      defaults.search,
      ["local", "pgvector"],
      "SEARCH_ADAPTER",
    ),
    selector: choices(
      env.SELECTOR_ADAPTER,
      defaults.selector,
      ["deterministic", "openai"],
      "SELECTOR_ADAPTER",
    ),
    runStore: choices(
      env.RUN_STORE,
      defaults.runStore,
      ["memory", "prisma"],
      "RUN_STORE",
    ),
    traceStore: choices(
      env.TRACE_STORE,
      defaults.traceStore,
      ["memory", "prisma"],
      "TRACE_STORE",
    ),
  } satisfies MvpAdapterConfig;
  if (config.search === "pgvector" && config.catalog !== "prisma") {
    throw new Error(
      "SEARCH_ADAPTER=pgvector requires CATALOG_ADAPTER=prisma.",
    );
  }
  if (config.traceStore === "prisma" && config.runStore !== "prisma") {
    throw new Error(
      "TRACE_STORE=prisma requires RUN_STORE=prisma.",
    );
  }
  if (config.runStore === "prisma" && config.traceStore !== "prisma") {
    throw new Error(
      "RUN_STORE=prisma requires TRACE_STORE=prisma.",
    );
  }
  return config;
}
/**
 * Runtime validation for the selected anonymous-MVP adapters. Validation-only
 * Prisma CLI placeholders are never accepted here: a selected Prisma runtime
 * requires DATABASE_URL. DIRECT_URL remains migration-only.
 */
export function validateSelectedMvpAdapters(
  config: MvpAdapterConfig,
  env: Environment = process.env,
): void {
  const required = new Set<string>();

  const usesPrisma =
    config.catalog === "prisma" ||
    config.search === "pgvector" ||
    config.runStore === "prisma" ||
    config.traceStore === "prisma";
  if (usesPrisma) {
    required.add("DATABASE_URL");
  }
  if (config.search === "pgvector") {
    required.add("OPENAI_API_KEY");
    required.add("OPENAI_EMBEDDING_MODEL");
    required.add("OPENAI_EMBEDDING_DIMENSIONS");
  }
  if (config.selector === "openai") {
    required.add("OPENAI_API_KEY");
    required.add("OPENAI_GENERATION_MODEL");
  }

  const missing = [...required].filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Selected MVP adapters require environment variables: ${missing.join(", ")}.`,
    );
  }
  if (
    config.search === "pgvector" &&
    env.OPENAI_EMBEDDING_MODEL?.trim() !== "text-embedding-3-small"
  ) {
    throw new Error(
      "OPENAI_EMBEDDING_MODEL must be text-embedding-3-small for pgvector search.",
    );
  }
  if (
    config.search === "pgvector" &&
    Number(env.OPENAI_EMBEDDING_DIMENSIONS) !== 1536
  ) {
    throw new Error(
      "OPENAI_EMBEDDING_DIMENSIONS must be exactly 1536 for pgvector search.",
    );
  }
}

export function validateSelectedLiveAdapters(
  config: AdapterConfig,
  env: Environment = process.env,
): void {
  const required = new Set<string>();

  if (config.auth === "authjs") {
    required.add("AUTH_SECRET");
    required.add("AUTH_GOOGLE_ID");
    required.add("AUTH_GOOGLE_SECRET");
    required.add("AUTH_KAKAO_ID");
    required.add("AUTH_KAKAO_SECRET");
  }
  if (
    config.catalog === "prisma" ||
    config.search === "pgvector" ||
    config.runStore === "prisma" ||
    config.traceStore === "prisma" ||
    config.engagementStore === "prisma"
  ) {
    required.add("DATABASE_URL");
    required.add("DIRECT_URL");
  }
  if (config.search === "pgvector") {
    required.add("OPENAI_API_KEY");
  }
  if (config.selector === "openai") {
    required.add("OPENAI_API_KEY");
  }

  const missing = [...required].filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Selected live adapters require environment variables: ${missing.join(", ")}.`,
    );
  }
}

export function isFullyDemoConfig(config: AdapterConfig): boolean {
  return (
    config.auth === "demo" &&
    config.catalog === "fixture" &&
    config.search === "local" &&
    config.selector === "deterministic" &&
    config.runStore === "memory" &&
    config.traceStore === "memory" &&
    config.engagementStore === "memory"
  );
}

export function isFullyMvpDemoConfig(
  config: MvpAdapterConfig,
): boolean {
  return (
    config.catalog === "fixture" &&
    config.search === "local" &&
    config.selector === "deterministic" &&
    config.runStore === "memory" &&
    config.traceStore === "memory"
  );
}

export function isFullyMvpLiveConfig(
  config: MvpAdapterConfig,
): boolean {
  return (
    config.catalog === "prisma" &&
    config.search === "pgvector" &&
    config.selector === "openai" &&
    config.runStore === "prisma" &&
    config.traceStore === "prisma"
  );
}
