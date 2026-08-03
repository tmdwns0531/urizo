import type { CatalogContent } from "../../contracts/catalog";
import type {
  DailyLineCandidate,
  DailyLineDayPart,
  DailyLineRecommendation,
  DailyLineSelectorAdapter,
  DailyLineTemperatureBand,
  DailyLineTone,
  DailyLineWeatherAdapter,
  DailyLineWeatherCondition,
  DailyLineWeatherSnapshot,
} from "../../contracts/daily-line-live";
import { DAILY_LINE_TONES } from "../../contracts/daily-line-live";
import {
  MVP_NEUTRAL_SANITIZED_SEARCH_INPUT,
  type SanitizedRecommendationSearchInput,
} from "../../contracts/mvp-search";
import type { CatalogRepository } from "../../contracts/ports";
import {
  filterMvpCatalog,
  getMvpFilterReasons,
} from "../catalog/filtering";
import { ExpiringAsyncCache } from "./expiring-async-cache";

export const DAILY_LINE_CANDIDATE_LIMIT = 24;
export const DAILY_LINE_CANDIDATE_HARD_LIMIT = 30;

interface CachedDailyLineDecision {
  contentId: string;
  tone: DailyLineTone;
  selectionMode: "OPENAI" | "FALLBACK";
}

export interface DailyLineLiveServiceOptions {
  catalog: CatalogRepository;
  weather: DailyLineWeatherAdapter;
  selector?: DailyLineSelectorAdapter;
  weatherCache: ExpiringAsyncCache<string, DailyLineWeatherSnapshot>;
  decisionCache: ExpiringAsyncCache<string, CachedDailyLineDecision>;
  now?: () => Date;
  candidateLimit?: number;
}

export class DailyLineUnavailableError extends Error {
  constructor() {
    super("Today's daily-line recommendation is unavailable.");
    this.name = "DailyLineUnavailableError";
  }
}

class DailyLineCatalogListError extends Error {
  constructor(code: string | null) {
    super("The daily-line catalog list is unavailable.");
    this.name = code
      ? `DailyLineCatalogListError_${code}`
      : "DailyLineCatalogListError";
  }
}

class DailyLineCatalogGetError extends Error {
  constructor(code: string | null) {
    super("The daily-line canonical catalog row is unavailable.");
    this.name = code
      ? `DailyLineCatalogGetError_${code}`
      : "DailyLineCatalogGetError";
  }
}

const DAILY_LINE_POLICY_INPUT: SanitizedRecommendationSearchInput = {
  ...MVP_NEUTRAL_SANITIZED_SEARCH_INPUT,
  selectedProviders: [
    ...MVP_NEUTRAL_SANITIZED_SEARCH_INPUT.selectedProviders,
  ],
  companions: [...MVP_NEUTRAL_SANITIZED_SEARCH_INPUT.companions],
  moods: [],
  desiredGenres: [],
  companionAvoidGenres: [],
  requiredGenres: [],
  excludedGenres: [],
};

export class DailyLineLiveService {
  private readonly now: () => Date;
  private readonly candidateLimit: number;

  constructor(private readonly options: DailyLineLiveServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.candidateLimit = normalizeCandidateLimit(options.candidateLimit);
  }

  async recommend(signal?: AbortSignal): Promise<DailyLineRecommendation> {
    const requestedAt = this.now();
    const weather = await this.readWeather(requestedAt, signal);
    const dayKey = toKstDayKey(requestedAt);
    const temperatureBand = toTemperatureBand(weather.temperatureCelsius);
    const dayPart = toKstDayPart(requestedAt);
    const cacheKey = [
      "daily-line-live-v1",
      dayKey,
      weather.source,
      weather.condition,
      temperatureBand,
      dayPart,
    ].join(":");

    let decision = await this.options.decisionCache.getOrLoad(
      cacheKey,
      () =>
        this.createDecision(
          dayKey,
          temperatureBand,
          dayPart,
          weather,
          cacheKey,
          signal,
        ),
    );
    let content = await this.readCanonicalEligibleContent(decision.contentId);

    if (!content) {
      this.options.decisionCache.delete(cacheKey);
      decision = await this.options.decisionCache.getOrLoad(
        cacheKey,
        () =>
          this.createDecision(
            dayKey,
            temperatureBand,
            dayPart,
            weather,
            cacheKey,
            signal,
          ),
      );
      content = await this.readCanonicalEligibleContent(decision.contentId);
    }

    if (!content) {
      this.options.decisionCache.delete(cacheKey);
      throw new DailyLineUnavailableError();
    }

    return {
      content,
      line: renderDailyLine(content.title, weather, decision.tone),
      weather,
      selectionMode: decision.selectionMode,
      generatedAt: requestedAt.toISOString(),
    };
  }

  private async readWeather(
    requestedAt: Date,
    signal?: AbortSignal,
  ): Promise<DailyLineWeatherSnapshot> {
    try {
      return await this.options.weatherCache.getOrLoad(
        "seoul-current-weather-v1",
        () => this.options.weather.getCurrent(signal),
      );
    } catch {
      return {
        locationName: "서울",
        observedAt: requestedAt.toISOString(),
        temperatureCelsius: null,
        apparentTemperatureCelsius: null,
        precipitationMillimeters: null,
        weatherCode: null,
        condition: "UNKNOWN",
        isDay: null,
        source: "UNAVAILABLE",
      };
    }
  }

  private async createDecision(
    dayKey: string,
    temperatureBand: DailyLineTemperatureBand,
    dayPart: DailyLineDayPart,
    weather: DailyLineWeatherSnapshot,
    cacheKey: string,
    signal?: AbortSignal,
  ): Promise<CachedDailyLineDecision> {
    let contents: CatalogContent[];
    try {
      contents = await this.options.catalog.list();
    } catch (error) {
      throw new DailyLineCatalogListError(readPrismaErrorCode(error));
    }
    const pool = buildDailyLineCandidatePool(
      contents,
      this.candidateLimit,
      dayKey,
    );
    if (pool.length === 0) {
      throw new DailyLineUnavailableError();
    }

    const candidates = pool.map(toDailyLineCandidate);
    if (this.options.selector && weather.source === "OPEN_METEO") {
      try {
        const selected = await this.options.selector.select(
          {
            dayKey,
            temperatureBand,
            dayPart,
            weather,
            candidates,
          },
          signal,
        );
        if (
          candidates.some(({ id }) => id === selected.contentId) &&
          DAILY_LINE_TONES.includes(selected.tone)
        ) {
          return {
            contentId: selected.contentId,
            tone: selected.tone,
            selectionMode: "OPENAI",
          };
        }
      } catch {
        // Provider errors and invalid output deliberately converge on the same
        // bounded fallback without logging provider payloads or prompts.
      }
    }

    return createFallbackDecision(candidates, weather, cacheKey);
  }

  private async readCanonicalEligibleContent(
    contentId: string,
  ): Promise<CatalogContent | null> {
    let content: CatalogContent | null;
    try {
      content = await this.options.catalog.getById(contentId);
    } catch (error) {
      throw new DailyLineCatalogGetError(readPrismaErrorCode(error));
    }
    if (!content) return null;
    return getMvpFilterReasons(content, DAILY_LINE_POLICY_INPUT).length === 0
      ? content
      : null;
  }
}

export function buildDailyLineCandidatePool(
  contents: readonly CatalogContent[],
  limit = DAILY_LINE_CANDIDATE_LIMIT,
  dayKey = "",
): CatalogContent[] {
  const normalizedLimit = normalizeCandidateLimit(limit);
  const eligible = filterMvpCatalog(
    [...new Map(contents.map((content) => [content.id, content])).values()],
    DAILY_LINE_POLICY_INPUT,
  ).eligible;
  const ranked = eligible
    .filter(
      (content) =>
        content.title.trim().length > 0 &&
        Number.isFinite(content.runtimeMinutes) &&
        content.runtimeMinutes > 0,
    )
    .map((content) => ({
      content,
      baseScore:
        normalizedVoteAverage(content.voteAverage) * 1.4 +
        Math.log1p(normalizedVoteCount(content.voteCount)) * 0.72 +
        (content.posterUrl ? 0.12 : 0) +
        stableFraction(`${dayKey}:${content.id}`) * 0.08,
    }));

  const selected: CatalogContent[] = [];
  const genreCounts = new Map<string, number>();
  const mediaCounts = new Map<CatalogContent["mediaType"], number>();
  const collectionCounts = new Map<string, number>();

  while (ranked.length > 0 && selected.length < normalizedLimit) {
    ranked.sort((left, right) => {
      const rightScore = diversityAdjustedScore(
        right.content,
        right.baseScore,
        genreCounts,
        mediaCounts,
        collectionCounts,
      );
      const leftScore = diversityAdjustedScore(
        left.content,
        left.baseScore,
        genreCounts,
        mediaCounts,
        collectionCounts,
      );
      return rightScore - leftScore || left.content.id.localeCompare(right.content.id);
    });
    const next = ranked.shift();
    if (!next) break;
    selected.push(next.content);
    const primaryGenre = next.content.genres[0];
    if (primaryGenre) {
      genreCounts.set(primaryGenre, (genreCounts.get(primaryGenre) ?? 0) + 1);
    }
    mediaCounts.set(
      next.content.mediaType,
      (mediaCounts.get(next.content.mediaType) ?? 0) + 1,
    );
    if (next.content.collectionId) {
      collectionCounts.set(
        next.content.collectionId,
        (collectionCounts.get(next.content.collectionId) ?? 0) + 1,
      );
    }
  }

  return selected;
}

export function toDailyLineCandidate(
  content: CatalogContent,
): DailyLineCandidate {
  return {
    id: content.id,
    title: clipCodePoints(content.title.trim(), 100),
    mediaType: content.mediaType,
    releaseYear: content.releaseYear,
    runtimeMinutes: content.runtimeMinutes,
    genres: content.genres.slice(0, 5),
    moods: content.moodTags.slice(0, 5),
    providers: [
      ...new Set(content.providers.map(({ provider }) => provider)),
    ],
    voteAverage: normalizedVoteAverage(content.voteAverage),
    voteCount: normalizedVoteCount(content.voteCount),
  };
}

export function toTemperatureBand(
  temperatureCelsius: number | null,
): DailyLineTemperatureBand {
  if (temperatureCelsius === null || !Number.isFinite(temperatureCelsius)) {
    return "MILD";
  }
  if (temperatureCelsius < 5) return "COLD";
  if (temperatureCelsius < 15) return "COOL";
  if (temperatureCelsius < 24) return "MILD";
  if (temperatureCelsius < 30) return "WARM";
  return "HOT";
}

export function toKstDayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

export function toKstDayPart(date: Date): DailyLineDayPart {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .find((part) => part.type === "hour")?.value ?? "0",
  );
  if (hour >= 5 && hour < 11) return "MORNING";
  if (hour >= 11 && hour < 17) return "DAY";
  if (hour >= 17 && hour < 22) return "EVENING";
  return "NIGHT";
}

function createFallbackDecision(
  candidates: readonly DailyLineCandidate[],
  weather: DailyLineWeatherSnapshot,
  cacheKey: string,
): CachedDailyLineDecision {
  const bounded = candidates.slice(0, Math.min(5, candidates.length));
  const index = stableHash(cacheKey) % bounded.length;
  return {
    contentId: bounded[index].id,
    tone: fallbackTone(weather),
    selectionMode: "FALLBACK",
  };
}

function fallbackTone(weather: DailyLineWeatherSnapshot): DailyLineTone {
  if (weather.temperatureCelsius !== null && weather.temperatureCelsius >= 30) {
    return "REFRESHING";
  }
  if (weather.temperatureCelsius !== null && weather.temperatureCelsius < 8) {
    return "COZY";
  }
  const tones: Record<DailyLineWeatherCondition, DailyLineTone> = {
    CLEAR: "CHEERFUL",
    CLOUDY: "COZY",
    FOG: "CALM",
    RAIN: "CALM",
    SNOW: "COZY",
    STORM: "IMMERSIVE",
    UNKNOWN: "REFRESHING",
  };
  return tones[weather.condition];
}

function renderDailyLine(
  title: string,
  weather: DailyLineWeatherSnapshot,
  tone: DailyLineTone,
): string {
  const safeTitle = clipCodePoints(title.trim(), 28);
  if (weather.source === "UNAVAILABLE") {
    return `오늘 한 편만 고른다면, 「${safeTitle}」부터 만나보세요.`;
  }
  const weatherLead: Record<DailyLineWeatherCondition, string> = {
    CLEAR: "맑은 서울의 오늘",
    CLOUDY: "구름 낀 서울의 오늘",
    FOG: "안개가 머문 서울의 오늘",
    RAIN: "비 오는 서울의 오늘",
    SNOW: "눈 내리는 서울의 오늘",
    STORM: "궂은 날씨의 서울 오늘",
    UNKNOWN: "서울의 지금",
  };
  const toneEnding: Record<DailyLineTone, string> = {
    COZY: "포근히 쉬어가 보세요.",
    CALM: "차분한 장면 속에 머물러 보세요.",
    REFRESHING: "기분 좋은 전환을 시작해 보세요.",
    CHEERFUL: "한결 가벼운 시간을 만나보세요.",
    IMMERSIVE: "이야기 속으로 깊이 빠져보세요.",
  };
  return `${weatherLead[weather.condition]}, 「${safeTitle}」 한 편과 함께 ${toneEnding[tone]}`;
}

function normalizeCandidateLimit(limit: number | undefined): number {
  if (limit === undefined) return DAILY_LINE_CANDIDATE_LIMIT;
  if (!Number.isFinite(limit) || limit <= 0) return DAILY_LINE_CANDIDATE_LIMIT;
  return Math.min(Math.floor(limit), DAILY_LINE_CANDIDATE_HARD_LIMIT);
}

function diversityAdjustedScore(
  content: CatalogContent,
  baseScore: number,
  genreCounts: ReadonlyMap<string, number>,
  mediaCounts: ReadonlyMap<CatalogContent["mediaType"], number>,
  collectionCounts: ReadonlyMap<string, number>,
): number {
  const primaryGenre = content.genres[0];
  const genrePenalty = primaryGenre ? (genreCounts.get(primaryGenre) ?? 0) * 0.16 : 0;
  const mediaPenalty = (mediaCounts.get(content.mediaType) ?? 0) * 0.65;
  const collectionPenalty = content.collectionId
    ? (collectionCounts.get(content.collectionId) ?? 0) * 1.25
    : 0;
  return baseScore - genrePenalty - mediaPenalty - collectionPenalty;
}

function normalizedVoteAverage(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : 0;
}

function normalizedVoteCount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function readPrismaErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^P\d{4}$/.test(error.code)
  ) {
    return error.code;
  }
  return null;
}

function stableHash(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function stableFraction(value: string): number {
  return stableHash(value) / 4_294_967_295;
}

function clipCodePoints(value: string, max: number): string {
  const codePoints = [...value];
  return codePoints.length <= max
    ? value
    : `${codePoints.slice(0, Math.max(1, max - 1)).join("")}…`;
}
