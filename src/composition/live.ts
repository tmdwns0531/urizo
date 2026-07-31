import type { MvpAdapterConfig } from "../config/adapters";
import type { PrismaLiveAdapterBundle } from "../adapters/prisma/factory";
import type { RecommendationPersistenceUnitOfWork } from "../contracts/mvp-ports";
import type { PgVectorDatabase } from "../adapters/search/pgvector-search-adapter";
import type { DemoAdapterSet } from "./demo";
import type { MvpAdapterOverrides, MvpAdapterSet } from "./types";

type Environment = Record<string, string | undefined>;

export interface ResolvedMvpAdapters {
  adapters: MvpAdapterSet;
  persistence: RecommendationPersistenceUnitOfWork;
  dispose(): Promise<void>;
}

function requiredEnvironmentValue(
  env: Environment,
  name: string,
): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required by the selected LIVE adapter.`);
  }
  return value;
}

/**
 * Resolves only selected LIVE capabilities. Concrete Prisma and OpenAI modules
 * are loaded after configuration validation at the composition boundary.
 */
export async function resolveMvpAdapters(
  config: MvpAdapterConfig,
  demo: DemoAdapterSet,
  env: Environment = process.env,
  overrides: MvpAdapterOverrides = {},
): Promise<ResolvedMvpAdapters> {
  const needsPrisma =
    (config.catalog === "prisma" && !overrides.catalog) ||
    (config.search === "pgvector" && !overrides.search) ||
    (config.runStore === "prisma" && !overrides.runs) ||
    (config.traceStore === "prisma" && !overrides.traces);

  let prismaBundle: PrismaLiveAdapterBundle | undefined;
  let disposed = false;
  const dispose = async (): Promise<void> => {
    if (disposed) return;
    disposed = true;
    if (!prismaBundle) return;
    try {
      await prismaBundle.disconnect();
    } catch {
      // Cleanup must not replace an already-created public response with a
      // provider-specific error. A future observability sink may count this.
    }
  };

  try {
    if (needsPrisma) {
      const { createPrismaLiveAdapters } = await import(
        "../adapters/prisma/factory"
      );
      prismaBundle = createPrismaLiveAdapters(
        requiredEnvironmentValue(env, "DATABASE_URL"),
      );
    }

    const requirePrisma = (): PrismaLiveAdapterBundle => {
      if (!prismaBundle) {
        throw new Error("A selected LIVE adapter requires Prisma.");
      }
      return prismaBundle;
    };

    const catalog =
      overrides.catalog ??
      (config.catalog === "fixture" ? demo.catalog : requirePrisma().catalog);

    let search = overrides.search;
    if (!search) {
      if (config.search === "local") {
        search = demo.search;
      } else {
        const [{ OpenAiEmbeddingClient }, { PgVectorSearchAdapter }] =
          await Promise.all([
            import("../adapters/search/openai-embedding-client"),
            import("../adapters/search/pgvector-search-adapter"),
          ]);
        const bundle = requirePrisma();
        const database: PgVectorDatabase = {
          async query<Row>(text: string, values: readonly unknown[]) {
            const rows = await bundle.client.$queryRawUnsafe<Row[]>(
              text,
              ...values,
            );
            return { rows };
          },
        };
        search = new PgVectorSearchAdapter({
          embeddings: new OpenAiEmbeddingClient({
            apiKey: requiredEnvironmentValue(env, "OPENAI_API_KEY"),
            model: requiredEnvironmentValue(
              env,
              "OPENAI_EMBEDDING_MODEL",
            ) as "text-embedding-3-small",
            dimensions: Number(
              requiredEnvironmentValue(
                env,
                "OPENAI_EMBEDDING_DIMENSIONS",
              ),
            ) as 1536,
          }),
          database,
        });
      }
    }

    let selector = overrides.selector;
    if (!selector) {
      if (config.selector === "deterministic") {
        selector = demo.selector;
      } else {
        const { OpenAiSelectorAdapter } = await import(
          "../adapters/recommendation/openai-selector-adapter"
        );
        selector = new OpenAiSelectorAdapter({
          apiKey: requiredEnvironmentValue(env, "OPENAI_API_KEY"),
          model: requiredEnvironmentValue(env, "OPENAI_GENERATION_MODEL"),
        });
      }
    }

    const runs =
      overrides.runs ??
      (config.runStore === "memory" ? demo.runs : requirePrisma().runs);
    const traces =
      overrides.traces ??
      (config.traceStore === "memory" ? demo.traces : requirePrisma().traces);
    let persistence = overrides.persistence;
    if (!persistence && runs === demo.runs && traces === demo.traces) {
      persistence = demo.persistence;
    }
    if (
      !persistence &&
      prismaBundle &&
      runs === prismaBundle.runs &&
      traces === prismaBundle.traces
    ) {
      persistence = prismaBundle.persistence;
    }
    if (!persistence) {
      throw new Error(
        "Custom Run/Trace overrides require an atomic persistence override.",
      );
    }

    return {
      adapters: { catalog, search, selector, runs, traces },
      persistence,
      dispose,
    };
  } catch (error) {
    await dispose();
    throw error;
  }
}