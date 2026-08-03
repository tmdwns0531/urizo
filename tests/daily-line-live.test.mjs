import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const rootPath = path.resolve(import.meta.dirname, "..");
const jiti = createJiti(import.meta.url, { moduleCache: false });
const importTs = (relativePath) =>
  jiti.import(fileURLToPath(new URL(`../${relativePath}`, import.meta.url)));

const {
  DailyLineLiveService,
  buildDailyLineCandidatePool,
  toDailyLineCandidate,
} = await importTs(
  "src/domains/daily-line-live/daily-line-live-service.ts",
);
const { ExpiringAsyncCache } = await importTs(
  "src/domains/daily-line-live/expiring-async-cache.ts",
);
const {
  OpenMeteoWeatherAdapter,
  weatherCodeToCondition,
} = await importTs(
  "src/adapters/daily-line-live/open-meteo-weather-adapter.ts",
);
const {
  OpenAiDailyLineSelectorAdapter,
} = await importTs(
  "src/adapters/daily-line-live/openai-daily-line-selector-adapter.ts",
);
const { DEMO_CATALOG } = await importTs("src/demo/fixtures/catalog.ts");

function cloneContent(content, overrides = {}) {
  return {
    ...content,
    genres: [...content.genres],
    moodTags: [...content.moodTags],
    companionTags: [...content.companionTags],
    originCountries: [...content.originCountries],
    productionCountries: [...content.productionCountries],
    providers: content.providers.map((provider) => ({ ...provider })),
    ...overrides,
  };
}

function createWeather(overrides = {}) {
  return {
    locationName: "서울",
    observedAt: "2026-08-03T18:20:00+09:00",
    temperatureCelsius: 27.4,
    apparentTemperatureCelsius: 29.1,
    precipitationMillimeters: 2.1,
    weatherCode: 61,
    condition: "RAIN",
    isDay: false,
    source: "OPEN_METEO",
    ...overrides,
  };
}

test("daily-line candidate pool is policy-safe, diverse, and strictly bounded", () => {
  const unsafeAdult = cloneContent(DEMO_CATALOG[0], {
    id: "unsafe-adult",
    ageRating: "18",
    voteAverage: 10,
    voteCount: 99_999_999,
  });
  const unsafeUnknown = cloneContent(DEMO_CATALOG[1], {
    id: "unsafe-unknown",
    ageRating: "UNKNOWN",
    voteAverage: 10,
    voteCount: 99_999_999,
  });
  const unavailable = cloneContent(DEMO_CATALOG[2], {
    id: "unsafe-providerless",
    providers: [],
    voteAverage: 10,
    voteCount: 99_999_999,
  });
  const pool = buildDailyLineCandidatePool(
    [...DEMO_CATALOG, unsafeAdult, unsafeUnknown, unavailable],
    6,
    "2026-08-03",
  );

  assert.equal(pool.length, 6);
  assert.ok(pool.every(({ ageRating }) => ageRating !== "18"));
  assert.ok(pool.every(({ ageRating }) => ageRating !== "UNKNOWN"));
  assert.ok(pool.every(({ providers }) => providers.length > 0));
  assert.ok(new Set(pool.map(({ mediaType }) => mediaType)).size >= 2);
  assert.ok(new Set(pool.flatMap(({ genres }) => genres)).size >= 3);

  const candidate = toDailyLineCandidate(pool[0]);
  assert.deepEqual(
    Object.keys(candidate).sort(),
    [
      "genres",
      "id",
      "mediaType",
      "moods",
      "providers",
      "releaseYear",
      "runtimeMinutes",
      "title",
      "voteAverage",
      "voteCount",
    ],
  );
  assert.doesNotMatch(JSON.stringify(candidate), /synopsis|watchUrl|posterUrl/);
});

test("daily-line service coalesces decisions and rechecks cached IDs against canonical policy", async () => {
  const contents = DEMO_CATALOG.slice(0, 8).map((content) =>
    cloneContent(content),
  );
  const byId = new Map(contents.map((content) => [content.id, content]));
  let listCalls = 0;
  let weatherCalls = 0;
  let selectorCalls = 0;
  let lastSelectorInput;
  const catalog = {
    async list() {
      listCalls += 1;
      return [...byId.values()].map((content) => cloneContent(content));
    },
    async getById(contentId) {
      const content = byId.get(contentId);
      return content ? cloneContent(content) : null;
    },
  };
  const weather = {
    async getCurrent() {
      weatherCalls += 1;
      return createWeather();
    },
  };
  const selector = {
    async select(input) {
      selectorCalls += 1;
      lastSelectorInput = input;
      return { contentId: input.candidates[0].id, tone: "CALM" };
    },
  };
  const service = new DailyLineLiveService({
    catalog,
    weather,
    selector,
    weatherCache: new ExpiringAsyncCache({ ttlMs: 60_000 }),
    decisionCache: new ExpiringAsyncCache({ ttlMs: 60_000 }),
    now: () => new Date("2026-08-03T09:20:00.000Z"),
  });

  const [first, concurrent] = await Promise.all([
    service.recommend(),
    service.recommend(),
  ]);
  assert.equal(first.content.id, concurrent.content.id);
  assert.equal(first.selectionMode, "OPENAI");
  assert.match(first.line, new RegExp(first.content.title));
  assert.ok([...first.line].length <= 80);
  assert.equal(weatherCalls, 1);
  assert.equal(listCalls, 1);
  assert.equal(selectorCalls, 1);
  assert.ok(lastSelectorInput.candidates.length <= 24);
  assert.doesNotMatch(
    JSON.stringify(lastSelectorInput.candidates),
    /synopsis|watchUrl|posterUrl/,
  );

  byId.set(first.content.id, {
    ...byId.get(first.content.id),
    ageRating: "18",
  });
  const afterPolicyChange = await service.recommend();
  assert.notEqual(afterPolicyChange.content.id, first.content.id);
  assert.notEqual(afterPolicyChange.content.ageRating, "18");
  assert.equal(listCalls, 2);
  assert.equal(selectorCalls, 2);
});

test("weather failure skips OpenAI and returns a bounded deterministic fallback", async () => {
  let selectorCalls = 0;
  const contents = DEMO_CATALOG.slice(0, 4).map((content) =>
    cloneContent(content),
  );
  const catalog = {
    async list() {
      return contents.map((content) => cloneContent(content));
    },
    async getById(contentId) {
      const content = contents.find(({ id }) => id === contentId);
      return content ? cloneContent(content) : null;
    },
  };
  const service = new DailyLineLiveService({
    catalog,
    weather: {
      async getCurrent() {
        throw new Error("provider detail that must not escape");
      },
    },
    selector: {
      async select() {
        selectorCalls += 1;
        throw new Error("must not run");
      },
    },
    weatherCache: new ExpiringAsyncCache({ ttlMs: 60_000 }),
    decisionCache: new ExpiringAsyncCache({ ttlMs: 60_000 }),
    now: () => new Date("2026-08-03T09:20:00.000Z"),
  });

  const result = await service.recommend();
  assert.equal(selectorCalls, 0);
  assert.equal(result.weather.source, "UNAVAILABLE");
  assert.equal(result.selectionMode, "FALLBACK");
  assert.match(result.line, /오늘 한 편만 고른다면/);
});

test("Open-Meteo adapter requests only current Seoul fields and normalizes WMO weather", async () => {
  let requestedUrl;
  const adapter = new OpenMeteoWeatherAdapter({
    fetchImplementation: async (input) => {
      requestedUrl = new URL(input);
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            current: {
              time: "2026-08-03T18:20",
              temperature_2m: 27.36,
              apparent_temperature: 29.14,
              precipitation: 2.06,
              rain: 2.06,
              snowfall: 0,
              weather_code: 61,
              is_day: 0,
            },
          };
        },
      };
    },
  });

  const weather = await adapter.getCurrent();
  assert.equal(requestedUrl.searchParams.get("timezone"), "Asia/Seoul");
  assert.match(requestedUrl.searchParams.get("current"), /temperature_2m/);
  assert.match(requestedUrl.searchParams.get("current"), /weather_code/);
  assert.equal(weather.locationName, "서울");
  assert.equal(weather.condition, "RAIN");
  assert.equal(weather.temperatureCelsius, 27.4);
  assert.equal(weather.observedAt, "2026-08-03T18:20:00+09:00");
  assert.equal(weather.isDay, false);
  assert.equal(weatherCodeToCondition(0), "CLEAR");
  assert.equal(weatherCodeToCondition(45), "FOG");
  assert.equal(weatherCodeToCondition(73), "SNOW");
  assert.equal(weatherCodeToCondition(96), "STORM");
});

test("OpenAI daily-line selector uses strict allowlists and sends no private catalog fields", async () => {
  let requestBody;
  const candidates = DEMO_CATALOG.slice(0, 3).map((content) =>
    toDailyLineCandidate(content),
  );
  const adapter = new OpenAiDailyLineSelectorAdapter({
    apiKey: "test-key",
    model: "test-model",
    fetchImplementation: async (_input, init) => {
      requestBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            output_text: JSON.stringify({
              contentId: candidates[1].id,
              tone: "COZY",
            }),
          };
        },
      };
    },
  });
  const result = await adapter.select({
    dayKey: "2026-08-03",
    temperatureBand: "WARM",
    dayPart: "EVENING",
    weather: createWeather(),
    candidates,
  });

  assert.deepEqual(result, { contentId: candidates[1].id, tone: "COZY" });
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.reasoning.effort, "none");
  assert.equal(requestBody.text.format.strict, true);
  assert.deepEqual(
    requestBody.text.format.schema.properties.contentId.enum,
    candidates.map(({ id }) => id),
  );
  const modelInput = JSON.parse(requestBody.input[1].content[0].text);
  assert.equal(modelInput.context.location, "서울");
  assert.doesNotMatch(
    JSON.stringify(modelInput.candidates),
    /synopsis|watchUrl|posterUrl|prompt|token/,
  );

  const invalidAdapter = new OpenAiDailyLineSelectorAdapter({
    apiKey: "test-key",
    model: "test-model",
    fetchImplementation: async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          output_text: JSON.stringify({
            contentId: "outside-allowlist",
            tone: "COZY",
          }),
        };
      },
    }),
  });
  await assert.rejects(
    invalidAdapter.select({
      dayKey: "2026-08-03",
      temperatureBand: "WARM",
      dayPart: "EVENING",
      weather: createWeather(),
      candidates,
    }),
    { name: "DailyLineSelectorInvalidOutputError" },
  );
});

test("landing loads the bounded daily-line card through a read-only API", async () => {
  const [landing, section, route, composition, documentation] = await Promise.all([
    readFile(
      path.resolve(rootPath, "src/components/landing/landing-page.tsx"),
      "utf8",
    ),
    readFile(
      path.resolve(
        rootPath,
        "src/components/daily-line-live/daily-line-live-section.tsx",
      ),
      "utf8",
    ),
    readFile(
      path.resolve(rootPath, "src/app/api/daily-line/route.ts"),
      "utf8",
    ),
    readFile(
      path.resolve(rootPath, "src/composition/daily-line-live.ts"),
      "utf8",
    ),
    readFile(
      path.resolve(rootPath, "docs/V09-DAILY-LINE-LIVE-MVP.md"),
      "utf8",
    ),
  ]);

  assert.match(
    landing,
    /<LandingHero\s*\/>[\s\S]*<DailyLineLiveSection\s*\/>[\s\S]*<RecommendationShowcase\s*\/>/,
  );
  assert.match(section, /^"use client";/);
  assert.match(section, /fetch\("\/api\/daily-line"/);
  assert.match(section, /lg:justify-end/);
  assert.match(section, /lg:max-w-\[38rem\]/);
  assert.match(section, /Open-Meteo/);
  assert.doesNotMatch(section, /\bfixed\b|\bsticky\b|localStorage|sessionStorage/);
  assert.match(route, /export async function GET\(request: Request\)/);
  assert.match(route, /loadDailyLineRecommendation\(\)/);
  assert.match(route, /INVALID_DAILY_LINE_REQUEST/);
  assert.doesNotMatch(route, /synopsis|watchUrl|naturalLanguage|prompt|token/);
  assert.doesNotMatch(composition, /^import .*adapters\/prisma\/factory/m);
  assert.match(composition, /await import\([\s\S]*adapters\/prisma\/factory/);
  assert.equal(
    existsSync(path.resolve(rootPath, "src/app/api/daily-line/route.ts")),
    true,
  );
  assert.match(documentation, /별도 임베딩 문서, 벡터 테이블, pgvector 인덱스 또는 검색 RAG를\s*추가하지 않는다/);
  assert.match(documentation, /최종 카드 DTO만 반환/);
});
