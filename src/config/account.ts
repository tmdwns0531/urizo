export type AccountStoreName = "memory" | "prisma";

export interface AccountAdapterConfig {
  appProfile: "demo" | "live";
  store: AccountStoreName;
}

type Environment = Record<string, string | undefined>;

/**
 * 계정 저장소는 프로필을 따라간다. live 에서 계정만 메모리에 두면 서버를 다시
 * 켤 때마다 사용자의 찜 목록이 사라지므로 고를 수 있게 두지 않는다.
 */
export function readAccountAdapterConfig(
  env: Environment = process.env,
): AccountAdapterConfig {
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
    store: appProfile === "live" ? "prisma" : "memory",
  };
}

export function validateSelectedAccountAdapter(
  config: AccountAdapterConfig,
  env: Environment = process.env,
): void {
  if (config.appProfile !== "live") return;
  // SESSION_SECRET 은 domains/account/session.ts 가 다시 확인하지만, 여기서
  // 먼저 막아야 요청이 들어오기 전에 잘못된 설정을 알 수 있다.
  const missing = ["DATABASE_URL", "SESSION_SECRET"].filter(
    (name) => !env[name]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error(
      `Selected account adapter requires environment variables: ${missing.join(", ")}.`,
    );
  }
}
