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
  catalog: "fixture";
  search: "local";
  selector: "deterministic" | "openai";
  runStore: "memory" | "prisma";
  traceStore: "memory" | "prisma";
}

export const MVP_DEFAULT_ADAPTER_CONFIG = {
  appProfile: "demo",
  catalog: "fixture",
  search: "local",
  selector: "deterministic",
  runStore: "memory",
  traceStore: "memory",
} as const satisfies MvpAdapterConfig;

type Environment = Record<string, string | undefined>;

const choices = <T extends string>(
  value: string | undefined,
  fallback: T,
  allowed: readonly T[],
  name: string,
): T => {
  const selected = (value ?? fallback) as T;
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
 * Reads only selectors that exist in the v0.6 anonymous MVP. Catalog and
 * search are intentionally fixed to the credential-free baseline adapters.
 */
export function readMvpAdapterConfig(
  env: Environment = process.env,
): MvpAdapterConfig {
  return {
    appProfile: choices(
      env.APP_PROFILE,
      "demo",
      ["demo", "live"],
      "APP_PROFILE",
    ),
    catalog: choices(
      env.CATALOG_ADAPTER,
      "fixture",
      ["fixture"],
      "CATALOG_ADAPTER",
    ),
    search: choices(
      env.SEARCH_ADAPTER,
      "local",
      ["local"],
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
  };
}

/**
 * Runtime validation for the selected anonymous-MVP adapters. Validation-only
 * Prisma CLI placeholders are never accepted here: a selected Prisma store
 * still requires the caller's real DATABASE_URL and DIRECT_URL values.
 */
export function validateSelectedMvpAdapters(
  config: MvpAdapterConfig,
  env: Environment = process.env,
): void {
  const required = new Set<string>();

  if (config.runStore === "prisma" || config.traceStore === "prisma") {
    required.add("DATABASE_URL");
    required.add("DIRECT_URL");
  }
  if (config.selector === "openai") {
    required.add("OPENAI_API_KEY");
  }

  const missing = [...required].filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Selected MVP adapters require environment variables: ${missing.join(", ")}.`,
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
