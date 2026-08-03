import { loadDailyLineRecommendation } from "../../../composition/daily-line-live";
import type {
  DailyLineLiveErrorResponse,
  DailyLineLivePublicResponse,
} from "../../../contracts/daily-line-live-api";
import type { DailyLineRecommendation } from "../../../contracts/daily-line-live";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.search.length > 0) {
    return Response.json(
      { error: "INVALID_DAILY_LINE_REQUEST" } satisfies DailyLineLiveErrorResponse,
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const recommendation = await loadDailyLineRecommendation();
    return Response.json(toPublicResponse(recommendation), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return Response.json(
      { error: "DAILY_LINE_UNAVAILABLE" } satisfies DailyLineLiveErrorResponse,
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

function toPublicResponse(
  recommendation: DailyLineRecommendation,
): DailyLineLivePublicResponse {
  const { content, weather } = recommendation;
  return {
    content: {
      title: content.title,
      releaseYear: content.releaseYear,
      runtimeMinutes: content.runtimeMinutes,
      genres: content.genres.slice(0, 3),
      providers: [
        ...new Set(content.providers.map(({ provider }) => provider)),
      ].slice(0, 3),
      posterUrl: content.posterUrl,
      backdropColor: content.backdropColor,
    },
    line: recommendation.line,
    weather: {
      locationName: weather.locationName,
      observedAt: weather.observedAt,
      temperatureCelsius: weather.temperatureCelsius,
      condition: weather.condition,
      source: weather.source,
    },
    selectionMode: recommendation.selectionMode,
  };
}
