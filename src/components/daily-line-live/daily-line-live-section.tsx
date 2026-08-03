"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  OTT_PROVIDERS,
  type OttProvider,
} from "../../contracts/catalog";
import {
  DAILY_LINE_WEATHER_CONDITIONS,
  type DailyLineWeatherCondition,
} from "../../contracts/daily-line-live";
import type { DailyLineLivePublicResponse } from "../../contracts/daily-line-live-api";
import { ProviderBadge } from "../provider-badge";

const WEATHER_PRESENTATION: Record<
  DailyLineWeatherCondition,
  { icon: string; label: string }
> = {
  CLEAR: { icon: "☀", label: "맑음" },
  CLOUDY: { icon: "☁", label: "흐림" },
  FOG: { icon: "◌", label: "안개" },
  RAIN: { icon: "☂", label: "비" },
  SNOW: { icon: "❄", label: "눈" },
  STORM: { icon: "ϟ", label: "뇌우" },
  UNKNOWN: { icon: "○", label: "날씨 확인 중" },
};

type DailyLineLoadState =
  | { status: "loading" }
  | { status: "ready"; recommendation: DailyLineLivePublicResponse }
  | { status: "unavailable" };

export function DailyLineLiveSection() {
  const [state, setState] = useState<DailyLineLoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/daily-line", {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("DAILY_LINE_UNAVAILABLE");
        const body: unknown = await response.json();
        if (!isDailyLineLivePublicResponse(body)) {
          throw new Error("DAILY_LINE_INVALID_RESPONSE");
        }
        setState({ status: "ready", recommendation: body });
      } catch {
        if (!controller.signal.aborted) {
          setState({ status: "unavailable" });
        }
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  if (state.status === "loading") return <DailyLineLiveSkeleton />;
  if (state.status === "unavailable") return <DailyLineLiveUnavailable />;
  return <DailyLineLiveCard recommendation={state.recommendation} />;
}

export function DailyLineLiveCard({
  recommendation,
}: {
  recommendation: DailyLineLivePublicResponse;
}) {
  const { content, weather } = recommendation;
  const weatherPresentation = WEATHER_PRESENTATION[weather.condition];
  const temperature =
    weather.temperatureCelsius === null
      ? null
      : `${formatTemperature(weather.temperatureCelsius)}°`;
  const posterBackground = content.posterUrl
    ? `linear-gradient(to top, rgba(7,10,14,.82), rgba(7,10,14,.04) 62%), url(${content.posterUrl})`
    : "linear-gradient(155deg, #334155, #10151b)";

  return (
    <section
      className="relative z-20 -mt-8 pb-10 sm:-mt-12 sm:pb-14 lg:-mt-16"
      aria-labelledby="daily-line-live-title"
      data-daily-line-live="ready"
    >
      <div className="app-container flex justify-center lg:justify-end">
        <article className="grid w-full min-w-0 grid-cols-[7.25rem_minmax(0,1fr)] overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#131b23]/95 shadow-[0_24px_70px_rgba(0,0,0,.34)] backdrop-blur-xl sm:grid-cols-[10rem_minmax(0,1fr)] lg:max-w-[38rem]">
          <div
            className="relative min-h-60 overflow-hidden bg-cover bg-center"
            style={{
              backgroundColor: content.backdropColor,
              backgroundImage: posterBackground,
            }}
            role="img"
            aria-label={`${content.title} 포스터`}
          >
            <span className="absolute inset-x-0 bottom-0 p-3 text-sm font-extrabold text-white sm:p-4">
              {content.releaseYear}
            </span>
          </div>

          <div className="min-w-0 p-4 sm:p-6">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-extrabold tracking-[0.12em] text-[#ff9b7c]">
                오늘의 한줄
              </p>
              <span
                className="inline-flex min-h-8 items-center rounded-full border border-white/10 bg-white/5 px-3 text-sm font-bold text-slate-200"
                aria-label={`서울 현재 날씨 ${weatherPresentation.label}${temperature ? ` ${temperature}` : ""}`}
              >
                <span aria-hidden="true">{weatherPresentation.icon}</span>
                <span className="ml-1.5">
                  서울 · {weatherPresentation.label}
                  {temperature ? ` ${temperature}` : ""}
                </span>
              </span>
            </div>

            <h2
              id="daily-line-live-title"
              className="mt-3 break-words text-xl font-black tracking-[-0.035em] text-white sm:text-2xl"
            >
              지금 날씨엔, {content.title}
            </h2>

            <blockquote className="mt-3 text-pretty text-base font-bold leading-7 text-slate-100">
              <span className="mr-1 text-[#ff7043]" aria-hidden="true">
                “
              </span>
              {recommendation.line}
              <span className="ml-1 text-[#ff7043]" aria-hidden="true">
                ”
              </span>
            </blockquote>

            <div className="mt-4 flex flex-wrap gap-1.5" aria-label="시청 가능 OTT">
              {content.providers.length > 0 ? (
                content.providers
                  .slice(0, 2)
                  .map((provider) => (
                    <ProviderBadge key={provider} provider={provider} compact />
                  ))
              ) : (
                <span className="text-sm font-medium text-slate-400">
                  제공처 확인 중
                </span>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-medium leading-6 text-slate-400">
                <p>
                  {recommendation.selectionMode === "OPENAI"
                    ? "실시간 AI 판단"
                    : "안전 기준 추천"}
                  {weather.source === "OPEN_METEO" ? " · " : null}
                  {weather.source === "OPEN_METEO" ? (
                    <time dateTime={weather.observedAt}>
                      {formatObservedAt(weather.observedAt)} 기준
                    </time>
                  ) : null}
                </p>
                {weather.source === "OPEN_METEO" ? (
                  <p>
                    날씨 데이터: {" "}
                    <a
                      href="https://open-meteo.com/"
                      className="underline decoration-white/30 underline-offset-4 hover:text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7043]"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open-Meteo
                    </a>
                  </p>
                ) : null}
              </div>
              <Link
                href="/choice"
                className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-extrabold text-[#ffad93] transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff7043]"
              >
                내 조건으로 다시 고르기
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

export function DailyLineLiveSkeleton() {
  return (
    <section
      className="relative z-20 -mt-8 pb-10 sm:-mt-12 sm:pb-14 lg:-mt-16"
      aria-label="오늘의 한줄 불러오는 중"
      data-daily-line-live="loading"
    >
      <div className="app-container flex justify-center lg:justify-end">
        <div
          className="flex min-h-44 w-full items-center justify-center rounded-[1.5rem] border border-white/10 bg-[#131b23]/95 px-6 text-center shadow-[0_24px_70px_rgba(0,0,0,.28)] sm:min-h-52 lg:max-w-[38rem]"
          role="status"
        >
          <p className="text-base font-bold leading-7 text-slate-300">
            서울 날씨와 오늘의 작품을 함께 살펴보고 있어요.
          </p>
        </div>
      </div>
    </section>
  );
}

export function DailyLineLiveUnavailable() {
  return (
    <section
      className="relative z-20 -mt-8 pb-10 sm:-mt-12 sm:pb-14 lg:-mt-16"
      aria-labelledby="daily-line-live-unavailable-title"
      data-daily-line-live="unavailable"
    >
      <div className="app-container flex justify-center lg:justify-end">
        <div className="w-full rounded-[1.5rem] border border-white/10 bg-[#131b23]/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,.28)] sm:p-7 lg:max-w-[38rem]">
          <p className="text-sm font-extrabold tracking-[0.12em] text-[#ff9b7c]">
            오늘의 한줄
          </p>
          <h2
            id="daily-line-live-unavailable-title"
            className="mt-2 text-xl font-black tracking-[-0.03em] text-white"
          >
            오늘의 작품을 잠시 준비하고 있어요.
          </h2>
          <p className="mt-2 text-base leading-7 text-slate-300">
            홈은 그대로 이용할 수 있어요. 내 조건으로 추천을 먼저 받아보세요.
          </p>
          <Link
            href="/choice"
            className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-[#ffad93] transition hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff7043]"
          >
            조건으로 추천받기
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function isDailyLineLivePublicResponse(
  value: unknown,
): value is DailyLineLivePublicResponse {
  if (
    !isRecord(value) ||
    !isRecord(value.content) ||
    !isRecord(value.weather)
  ) {
    return false;
  }
  const { content, weather } = value;
  return (
    typeof content.title === "string" &&
    content.title.trim().length > 0 &&
    typeof content.releaseYear === "number" &&
    Number.isInteger(content.releaseYear) &&
    typeof content.runtimeMinutes === "number" &&
    Number.isInteger(content.runtimeMinutes) &&
    Array.isArray(content.genres) &&
    content.genres.every((genre) => typeof genre === "string") &&
    Array.isArray(content.providers) &&
    content.providers.every(isOttProvider) &&
    (content.posterUrl === null || typeof content.posterUrl === "string") &&
    typeof content.backdropColor === "string" &&
    typeof value.line === "string" &&
    value.line.trim().length > 0 &&
    [...value.line].length <= 80 &&
    weather.locationName === "서울" &&
    typeof weather.observedAt === "string" &&
    (weather.temperatureCelsius === null ||
      (typeof weather.temperatureCelsius === "number" &&
        Number.isFinite(weather.temperatureCelsius))) &&
    typeof weather.condition === "string" &&
    DAILY_LINE_WEATHER_CONDITIONS.includes(
      weather.condition as DailyLineWeatherCondition,
    ) &&
    (weather.source === "OPEN_METEO" ||
      weather.source === "DEMO" ||
      weather.source === "UNAVAILABLE") &&
    (value.selectionMode === "OPENAI" || value.selectionMode === "FALLBACK")
  );
}

function isOttProvider(value: unknown): value is OttProvider {
  return typeof value === "string" && OTT_PROVIDERS.includes(value as OttProvider);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatTemperature(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatObservedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "현재";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
