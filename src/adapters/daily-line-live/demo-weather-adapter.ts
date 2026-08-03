import type {
  DailyLineWeatherAdapter,
  DailyLineWeatherSnapshot,
} from "../../contracts/daily-line-live";

/** Credential-free, non-networked weather used only by the Demo preset. */
export class DemoDailyLineWeatherAdapter implements DailyLineWeatherAdapter {
  async getCurrent(): Promise<DailyLineWeatherSnapshot> {
    return {
      locationName: "서울",
      observedAt: "2026-01-01T18:00:00+09:00",
      temperatureCelsius: 18,
      apparentTemperatureCelsius: 18,
      precipitationMillimeters: 0,
      weatherCode: 3,
      condition: "CLOUDY",
      isDay: false,
      source: "DEMO",
    };
  }
}
