import {
  readAccountAdapterConfig,
  validateSelectedAccountAdapter,
  type AccountAdapterConfig,
} from "../config/account";
import type {
  AccountRepository,
  WatchlistRepository,
} from "../contracts/account";
import {
  MemoryAccountRepository,
  MemoryWatchlistRepository,
} from "../adapters/memory/memory-account-repository";
import { resolveSessionSecret } from "../domains/account/session";

type Environment = Record<string, string | undefined>;

export interface AccountComposition {
  accounts: AccountRepository;
  watchlist: WatchlistRepository;
  /** 세션 서명 키. live 에서 비어 있으면 여기 오기 전에 던진다. */
  sessionSecret: string;
  profile: "demo" | "live";
  /** Prisma 를 쓸 때만 실제로 연결을 닫는다. 메모리 저장소는 할 일이 없다. */
  dispose(): Promise<void>;
}

export interface CreateAccountCompositionOptions {
  config?: AccountAdapterConfig;
  env?: Environment;
  accounts?: AccountRepository;
  watchlist?: WatchlistRepository;
}

function requiredEnvironmentValue(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required by the account adapter.`);
  return value;
}

export async function createAccountComposition(
  options: CreateAccountCompositionOptions = {},
): Promise<AccountComposition> {
  const env = options.env ?? process.env;
  const config = options.config ?? readAccountAdapterConfig(env);
  validateSelectedAccountAdapter(config, env);

  const sessionSecret = resolveSessionSecret(
    config.appProfile,
    env.SESSION_SECRET,
  );

  if (config.store === "memory" || (options.accounts && options.watchlist)) {
    return {
      accounts: options.accounts ?? new MemoryAccountRepository(),
      watchlist: options.watchlist ?? new MemoryWatchlistRepository(),
      sessionSecret,
      profile: config.appProfile,
      dispose: async () => {},
    };
  }

  // Prisma 모듈은 설정 검증을 통과한 뒤에만 불러온다. demo 는 이 줄에 닿지
  // 않으므로 `.env.local` 없이도 앱이 뜬다.
  const [{ createPrismaLiveAdapters }, accountModule] = await Promise.all([
    import("../adapters/prisma/factory"),
    import("../adapters/prisma/prisma-account-repository"),
  ]);
  const bundle = createPrismaLiveAdapters(
    requiredEnvironmentValue(env, "DATABASE_URL"),
  );
  const client = bundle.client as unknown as
    import("../adapters/prisma/prisma-account-repository").PrismaAccountClient;

  return {
    accounts:
      options.accounts ?? new accountModule.PrismaAccountRepository(client),
    watchlist:
      options.watchlist ?? new accountModule.PrismaWatchlistRepository(client),
    sessionSecret,
    profile: config.appProfile,
    dispose: bundle.disconnect,
  };
}

type AccountGlobal = typeof globalThis & {
  __ottDamoaMemoryAccountStore?: {
    accounts: AccountRepository;
    watchlist: WatchlistRepository;
  };
};

const accountGlobal = globalThis as AccountGlobal;

/**
 * 메모리 저장소는 프로세스에 하나만 둔다. 요청마다 새로 만들면 방금 가입한
 * 계정이 다음 요청에서 사라진다.
 */
function sharedMemoryStore(): {
  accounts: AccountRepository;
  watchlist: WatchlistRepository;
} {
  if (!accountGlobal.__ottDamoaMemoryAccountStore) {
    accountGlobal.__ottDamoaMemoryAccountStore = {
      accounts: new MemoryAccountRepository(),
      watchlist: new MemoryWatchlistRepository(),
    };
  }
  return accountGlobal.__ottDamoaMemoryAccountStore;
}

/**
 * Prisma 를 쓸 때는 요청마다 새로 만들고 끝나면 닫는다.
 *
 * `composition/index.ts` 가 같은 규칙을 쓰는 이유와 같다 — workerd 의 TCP 소켓과
 * pg 풀은 요청 경계를 넘으면 안 된다. 전역에 캐시해 두면 두 번째 요청부터
 * 죽은 소켓을 잡고 간헐적으로 실패한다.
 */
export async function withAccountComposition<T>(
  operation: (composition: AccountComposition) => Promise<T>,
): Promise<T> {
  const env = process.env;
  const config = readAccountAdapterConfig(env);

  if (config.store === "memory") {
    const shared = sharedMemoryStore();
    return operation(
      await createAccountComposition({ config, env, ...shared }),
    );
  }

  const composition = await createAccountComposition({ config, env });
  try {
    return await operation(composition);
  } finally {
    await composition.dispose();
  }
}
