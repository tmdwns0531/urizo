import type {
  DailyLineWeatherAdapter,
  DailyLineWeatherCondition,
  DailyLineWeatherSnapshot,
} from "../../contracts/daily-line-live";

const DEFAULT_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_TIMEOUT_MS = 6_000;

export interface OpenMeteoFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type OpenMeteoFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<OpenMeteoFetchResponse>;

export interface OpenMeteoWeatherAdapterOptions {
  latitude?: number;
  longitude?: number;
  endpoint?: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImplementation?: OpenMeteoFetch;
}

export class DailyLineWeatherProviderError extends Error {
  constructor() {
    super("The daily-line weather provider request failed.");
    this.name = "DailyLineWeatherProviderError";
  }
}

export class OpenMeteoWeatherAdapter implements DailyLineWeatherAdapter {
  private readonly latitude: number;
  private readonly longitude: number;
  private readonly endpoint: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly fetchImplementation: OpenMeteoFetch;

  constructor(options: OpenMeteoWeatherAdapterOptions = {}) {
    this.latitude = finiteCoordinate(options.latitude ?? 37.5665, "latitude");
    this.longitude = finiteCoordinate(options.longitude ?? 126.978, "longitude");
    this.endpoint = options.endpoint?.trim() || DEFAULT_ENDPOINT;
    this.apiKey = options.apiKey?.trim() || undefined;
    this.timeoutMs =
      Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0
        ? Math.floor(options.timeoutMs as number)
        : DEFAULT_TIMEOUT_MS;
    this.fetchImplementation =
      options.fetchImplementation ?? (globalThis.fetch as OpenMeteoFetch);
  }

  async getCurrent(signal?: AbortSignal): Promise<DailyLineWeatherSnapshot> {
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(signal?.reason);
    if (signal?.aborted) abortFromCaller();
    else signal?.addEventListener("abort", abortFromCaller, { once: true });
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      const url = new URL(this.endpoint);
      url.searchParams.set("latitude", String(this.latitude));
      url.searchParams.set("longitude", String(this.longitude));
      url.searchParams.set(
        "current",
        [
          "temperature_2m",
          "apparent_temperature",
          "precipitation",
          "rain",
          "snowfall",
          "weather_code",
          "is_day",
        ].join(","),
      );
      url.searchParams.set("timezone", "Asia/Seoul");
      url.searchParams.set("forecast_days", "1");
      if (this.apiKey) {
        url.searchParams.set("apikey", this.apiKey);
      }

      const timeout = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new DailyLineWeatherProviderError());
        }, this.timeoutMs);
      });
      const response = await Promise.race([
        this.fetchImplementation(url, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        }),
        timeout,
      ]);
      if (!response.ok) {
        throw new DailyLineWeatherProviderError();
      }

      const body = await response.json();
      const current = readCurrentWeather(body);
      return {
        locationName: "서울",
        observedAt: normalizeSeoulTimestamp(current.time),
        temperatureCelsius: roundOne(current.temperature_2m),
        apparentTemperatureCelsius: roundOne(current.apparent_temperature),
        precipitationMillimeters: roundOne(current.precipitation),
        weatherCode: Math.round(current.weather_code),
        condition: weatherCodeToCondition(current.weather_code),
        isDay: current.is_day === 1,
        source: "OPEN_METEO",
      };
    } catch (error) {
      if (error instanceof DailyLineWeatherProviderError) throw error;
      throw new DailyLineWeatherProviderError();
    } finally {
      signal?.removeEventListener("abort", abortFromCaller);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }
  }
}

interface OpenMeteoCurrentWeather {
  time: string;
  temperature_2m: number;
  apparent_temperature: number;
  precipitation: number;
  rain: number;
  snowfall: number;
  weather_code: number;
  is_day: 0 | 1;
}

function readCurrentWeather(value: unknown): OpenMeteoCurrentWeather {
  if (!isRecord(value) || !isRecord(value.current)) {
    throw new DailyLineWeatherProviderError();
  }
  const current = value.current;
  const numericKeys = [
    "temperature_2m",
    "apparent_temperature",
    "precipitation",
    "rain",
    "snowfall",
    "weather_code",
  ] as const;
  if (
    typeof current.time !== "string" ||
    current.time.trim().length === 0 ||
    numericKeys.some(
      (key) =>
        typeof current[key] !== "number" || !Number.isFinite(current[key]),
    ) ||
    (current.is_day !== 0 && current.is_day !== 1)
  ) {
    throw new DailyLineWeatherProviderError();
  }
  return current as unknown as OpenMeteoCurrentWeather;
}

export function weatherCodeToCondition(
  weatherCode: number,
): DailyLineWeatherCondition {
  const code = Math.round(weatherCode);
  if (code === 0) return "CLEAR";
  if (code >= 1 && code <= 3) return "CLOUDY";
  if (code === 45 || code === 48) return "FOG";
  if (
    (code >= 51 && code <= 67) ||
    (code >= 80 && code <= 82)
  ) {
    return "RAIN";
  }
  if (
    (code >= 71 && code <= 77) ||
    code === 85 ||
    code === 86
  ) {
    return "SNOW";
  }
  if (code >= 95 && code <= 99) return "STORM";
  return "UNKNOWN";
}

function normalizeSeoulTimestamp(value: string): string {
  const trimmed = value.trim();
  if (/(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00+09:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}+09:00`;
  }
  throw new DailyLineWeatherProviderError();
}

function finiteCoordinate(value: number, name: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be finite.`);
  }
  return value;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
