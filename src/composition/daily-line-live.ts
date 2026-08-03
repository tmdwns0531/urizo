import {
  readMvpAdapterConfig,
  validateSelectedMvpAdapters,
  type MvpAdapterConfig,
} from "../config/adapters";
import type {
  DailyLineRecommendation,
  DailyLineSelectorAdapter,
  DailyLineTone,
  DailyLineWeatherAdapter,
  DailyLineWeatherSnapshot,
} from "../contracts/daily-line-live";
import type { CatalogRepository } from "../contracts/ports";
import { FixtureCatalogRepository } from "../adapters/catalog/fixture-catalog-repository";
import { DemoDailyLineWeatherAdapter } from "../adapters/daily-line-live/demo-weather-adapter";
import {
  DailyLineLiveService,
  type DailyLineLiveServiceOptions,
} from "../domains/daily-line-live/daily-line-live-service";
import { ExpiringAsyncCache } from "../domains/daily-line-live/expiring-async-cache";

type Environment = Record<string, string | undefined>;

interface CachedDecision {
  contentId: string;
  tone: DailyLineTone;
  selectionMode: "OPENAI" | "FALLBACK";
}

interface DailyLineRuntimeCache {
  weather: ExpiringAsyncCache<string, DailyLineWeatherSnapshot>;
  decisions: ExpiringAsyncCache<string, CachedDecision>;
}

interface DailyLineRuntimeGlobal {
  __ottDamoaDailyLineRuntimeCache?: DailyLineRuntimeCache;
}

export interface DailyLineCompositionOverrides {
  catalog?: CatalogRepository;
  weather?: DailyLineWeatherAdapter;
  selector?: DailyLineSelectorAdapter;
  weatherCache?: ExpiringAsyncCache<string, DailyLineWeatherSnapshot>;
  decisionCache?: DailyLineLiveServiceOptions["decisionCache"];
}

export interface CreateDailyLineCompositionOptions {
  env?: Environment;
  config?: MvpAdapterConfig;
  overrides?: DailyLineCompositionOverrides;
}

export interface DailyLineComposition {
  service: DailyLineLiveService;
  dispose(): Promise<void>;
}

export async function createDailyLineComposition(
  options: CreateDailyLineCompositionOptions = {},
): Promise<DailyLineComposition> {
  const env = options.env ?? process.env;
  const config = options.config ?? readMvpAdapterConfig(env);
  validateSelectedMvpAdapters(config, env);
  const overrides = options.overrides ?? {};
  let dispose = async (): Promise<void> => {};

  try {
    let catalog = overrides.catalog;
    if (!catalog) {
      if (config.catalog === "fixture") {
        catalog = new FixtureCatalogRepository();
      } else {
        const { createPrismaLiveAdapters } = await import(
          "../adapters/prisma/factory"
        );
        const bundle = createPrismaLiveAdapters(
          requiredEnvironmentValue(env, "DATABASE_URL"),
        );
        catalog = bundle.catalog;
        let disposed = false;
        dispose = async () => {
          if (disposed) return;
          disposed = true;
          try {
            await bundle.disconnect();
          } catch {
            // Cleanup errors must not replace a completed public response.
          }
        };
      }
    }

    let weather = overrides.weather;
    if (!weather) {
      if (config.appProfile === "live") {
        const { OpenMeteoWeatherAdapter } = await import(
          "../adapters/daily-line-live/open-meteo-weather-adapter"
        );
        weather = new OpenMeteoWeatherAdapter({
          endpoint: env.DAILY_LINE_WEATHER_ENDPOINT,
          apiKey: env.DAILY_LINE_WEATHER_API_KEY,
        });
      } else {
        weather = new DemoDailyLineWeatherAdapter();
      }
    }

    let selector = overrides.selector;
    if (!selector && config.selector === "openai") {
      const { OpenAiDailyLineSelectorAdapter } = await import(
        "../adapters/daily-line-live/openai-daily-line-selector-adapter"
      );
      selector = new OpenAiDailyLineSelectorAdapter({
        apiKey: requiredEnvironmentValue(env, "OPENAI_API_KEY"),
        model: requiredEnvironmentValue(env, "OPENAI_GENERATION_MODEL"),
      });
    }

    const runtimeCache = readRuntimeCache();
    return {
      service: new DailyLineLiveService({
        catalog,
        weather,
        selector,
        weatherCache: overrides.weatherCache ?? runtimeCache.weather,
        decisionCache: overrides.decisionCache ?? runtimeCache.decisions,
      }),
      dispose,
    };
  } catch (error) {
    await dispose();
    throw error;
  }
}

export async function loadDailyLineRecommendation(): Promise<DailyLineRecommendation> {
  const env = process.env;
  const config = readMvpAdapterConfig(env);
  validateSelectedMvpAdapters(config, env);

  let weather: DailyLineWeatherAdapter;
  if (config.appProfile === "live") {
    const { OpenMeteoWeatherAdapter } = await import(
      "../adapters/daily-line-live/open-meteo-weather-adapter"
    );
    weather = new OpenMeteoWeatherAdapter({
      endpoint: env.DAILY_LINE_WEATHER_ENDPOINT,
      apiKey: env.DAILY_LINE_WEATHER_API_KEY,
    });
  } else {
    weather = new DemoDailyLineWeatherAdapter();
  }

  let selector: DailyLineSelectorAdapter | undefined;
  if (config.selector === "openai") {
    const { OpenAiDailyLineSelectorAdapter } = await import(
      "../adapters/daily-line-live/openai-daily-line-selector-adapter"
    );
    selector = new OpenAiDailyLineSelectorAdapter({
      apiKey: requiredEnvironmentValue(env, "OPENAI_API_KEY"),
      model: requiredEnvironmentValue(env, "OPENAI_GENERATION_MODEL"),
    });
  }

  const runtimeCache = readRuntimeCache();
  const { withMvpComposition } = await import("./index");
  return withMvpComposition(async ({ adapters }) => {
    const service = new DailyLineLiveService({
      catalog: adapters.catalog,
      weather,
      selector,
      weatherCache: runtimeCache.weather,
      decisionCache: runtimeCache.decisions,
    });
    return service.recommend();
  });
}

function readRuntimeCache(): DailyLineRuntimeCache {
  const runtime = globalThis as typeof globalThis & DailyLineRuntimeGlobal;
  runtime.__ottDamoaDailyLineRuntimeCache ??= {
    weather: new ExpiringAsyncCache({
      ttlMs: 10 * 60 * 1_000,
      staleIfErrorMs: 60 * 60 * 1_000,
      maxEntries: 4,
    }),
    decisions: new ExpiringAsyncCache({
      ttlMs: 30 * 60 * 1_000,
      staleIfErrorMs: 90 * 60 * 1_000,
      maxEntries: 32,
    }),
  };
  return runtime.__ottDamoaDailyLineRuntimeCache;
}

function requiredEnvironmentValue(
  env: Environment,
  name: string,
): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required by the selected daily-line adapter.`);
  }
  return value;
}
