import type { CatalogContent } from "./catalog";

export const DAILY_LINE_WEATHER_CONDITIONS = [
  "CLEAR",
  "CLOUDY",
  "FOG",
  "RAIN",
  "SNOW",
  "STORM",
  "UNKNOWN",
] as const;

export type DailyLineWeatherCondition =
  (typeof DAILY_LINE_WEATHER_CONDITIONS)[number];

export interface DailyLineWeatherSnapshot {
  locationName: "서울";
  observedAt: string;
  temperatureCelsius: number | null;
  apparentTemperatureCelsius: number | null;
  precipitationMillimeters: number | null;
  weatherCode: number | null;
  condition: DailyLineWeatherCondition;
  isDay: boolean | null;
  source: "OPEN_METEO" | "DEMO" | "UNAVAILABLE";
}

export interface DailyLineWeatherAdapter {
  getCurrent(signal?: AbortSignal): Promise<DailyLineWeatherSnapshot>;
}

export const DAILY_LINE_TEMPERATURE_BANDS = [
  "COLD",
  "COOL",
  "MILD",
  "WARM",
  "HOT",
] as const;
export type DailyLineTemperatureBand =
  (typeof DAILY_LINE_TEMPERATURE_BANDS)[number];

export const DAILY_LINE_DAY_PARTS = [
  "MORNING",
  "DAY",
  "EVENING",
  "NIGHT",
] as const;
export type DailyLineDayPart = (typeof DAILY_LINE_DAY_PARTS)[number];

export const DAILY_LINE_TONES = [
  "COZY",
  "CALM",
  "REFRESHING",
  "CHEERFUL",
  "IMMERSIVE",
] as const;
export type DailyLineTone = (typeof DAILY_LINE_TONES)[number];

export interface DailyLineCandidate {
  id: string;
  title: string;
  mediaType: CatalogContent["mediaType"];
  releaseYear: number;
  runtimeMinutes: number;
  genres: string[];
  moods: string[];
  providers: CatalogContent["providers"][number]["provider"][];
  voteAverage: number;
  voteCount: number;
}

export interface DailyLineSelectorInput {
  dayKey: string;
  temperatureBand: DailyLineTemperatureBand;
  dayPart: DailyLineDayPart;
  weather: DailyLineWeatherSnapshot;
  candidates: readonly DailyLineCandidate[];
}

export interface DailyLineSelectorOutput {
  contentId: string;
  tone: DailyLineTone;
}

export interface DailyLineSelectorAdapter {
  select(
    input: DailyLineSelectorInput,
    signal?: AbortSignal,
  ): Promise<DailyLineSelectorOutput>;
}

export interface DailyLineRecommendation {
  content: CatalogContent;
  line: string;
  weather: DailyLineWeatherSnapshot;
  selectionMode: "OPENAI" | "FALLBACK";
  generatedAt: string;
}
