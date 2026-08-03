import type { OttProvider } from "./catalog";
import type {
  DailyLineWeatherCondition,
  DailyLineWeatherSnapshot,
} from "./daily-line-live";

export interface DailyLineLivePublicResponse {
  content: {
    title: string;
    releaseYear: number;
    runtimeMinutes: number;
    genres: string[];
    providers: OttProvider[];
    posterUrl: string | null;
    backdropColor: string;
  };
  line: string;
  weather: {
    locationName: "서울";
    observedAt: string;
    temperatureCelsius: number | null;
    condition: DailyLineWeatherCondition;
    source: DailyLineWeatherSnapshot["source"];
  };
  selectionMode: "OPENAI" | "FALLBACK";
}

export interface DailyLineLiveErrorResponse {
  error: "DAILY_LINE_UNAVAILABLE" | "INVALID_DAILY_LINE_REQUEST";
}
