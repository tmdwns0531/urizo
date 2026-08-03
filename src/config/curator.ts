export type CuratorAdapterName = "deterministic" | "openai";

export interface CuratorAdapterConfig {
  appProfile: "demo" | "live";
  interpreter: CuratorAdapterName;
}

type Environment = Record<string, string | undefined>;

export function readCuratorAdapterConfig(
  env: Environment = process.env,
): CuratorAdapterConfig {
  const forceLive = env.OTT_DAMOA_PROFILE_OVERRIDE?.trim() === "live";
  const requestedProfile = env.APP_PROFILE?.trim() || "demo";
  if (requestedProfile !== "demo" && requestedProfile !== "live") {
    throw new Error(
      `APP_PROFILE must be one of demo, live; received "${requestedProfile}".`,
    );
  }
  const appProfile = forceLive ? "live" : requestedProfile;
  return {
    appProfile,
    interpreter: appProfile === "live" ? "openai" : "deterministic",
  };
}

export function validateSelectedCuratorAdapter(
  config: CuratorAdapterConfig,
  env: Environment = process.env,
): void {
  if (config.interpreter !== "openai") return;
  const missing = ["OPENAI_API_KEY", "OPENAI_GENERATION_MODEL"].filter(
    (name) => !env[name]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error(
      `Selected curator adapter requires environment variables: ${missing.join(", ")}.`,
    );
  }
}
