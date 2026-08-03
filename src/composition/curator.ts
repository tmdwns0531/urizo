import type { CuratorConversationInterpreter, CuratorServices } from "../contracts/curator";
import {
  readCuratorAdapterConfig,
  validateSelectedCuratorAdapter,
  type CuratorAdapterConfig,
} from "../config/curator";
import { CuratorConversationService } from "../domains/curator/conversation";
import { DeterministicCuratorInterpreter } from "../domains/curator/deterministic-interpreter";

type Environment = Record<string, string | undefined>;

export interface CuratorComposition {
  services: CuratorServices;
}

export interface CreateCuratorCompositionOptions {
  config?: CuratorAdapterConfig;
  env?: Environment;
  primary?: CuratorConversationInterpreter;
  fallback?: CuratorConversationInterpreter;
}

function requiredEnvironmentValue(env: Environment, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required by the curator adapter.`);
  return value;
}

export async function createCuratorComposition(
  options: CreateCuratorCompositionOptions = {},
): Promise<CuratorComposition> {
  const env = options.env ?? process.env;
  const config = options.config ?? readCuratorAdapterConfig(env);
  validateSelectedCuratorAdapter(config, env);
  const deterministic =
    options.fallback ?? new DeterministicCuratorInterpreter();
  let primary = options.primary;
  if (!primary) {
    if (config.interpreter === "deterministic") {
      primary = deterministic;
    } else {
      const { OpenAiCuratorAdapter } = await import(
        "../adapters/curator/openai-curator-adapter"
      );
      primary = new OpenAiCuratorAdapter({
        apiKey: requiredEnvironmentValue(env, "OPENAI_API_KEY"),
        model: requiredEnvironmentValue(env, "OPENAI_GENERATION_MODEL"),
      });
    }
  }
  return {
    services: new CuratorConversationService(
      primary,
      config.interpreter === "openai" ? deterministic : undefined,
    ),
  };
}

type CachedCuratorComposition = {
  key: string;
  promise: Promise<CuratorComposition>;
};

type CuratorGlobal = typeof globalThis & {
  __ottDamoaCuratorComposition?: CachedCuratorComposition;
};

const curatorGlobal = globalThis as CuratorGlobal;

export function getCuratorComposition(): Promise<CuratorComposition> {
  const env = process.env;
  const config = readCuratorAdapterConfig(env);
  const key = JSON.stringify(config);
  if (curatorGlobal.__ottDamoaCuratorComposition?.key === key) {
    return curatorGlobal.__ottDamoaCuratorComposition.promise;
  }
  const entry: CachedCuratorComposition = {
    key,
    promise: createCuratorComposition({ config, env }),
  };
  entry.promise = entry.promise.catch((error) => {
    if (curatorGlobal.__ottDamoaCuratorComposition === entry) {
      delete curatorGlobal.__ottDamoaCuratorComposition;
    }
    throw error;
  });
  curatorGlobal.__ottDamoaCuratorComposition = entry;
  return entry.promise;
}

export async function withCuratorComposition<T>(
  operation: (composition: CuratorComposition) => Promise<T>,
): Promise<T> {
  return operation(await getCuratorComposition());
}
