"use client";

import type { MediaTypePreference } from "../../contracts/mvp-search";
import {
  DURATION_OPTIONS,
  GENRE_OPTIONS,
  MOOD_OPTIONS,
  NO_COMPANION_OPTION,
  ORIGIN_OPTIONS,
  OTT_OPTIONS,
  WHO_OPTIONS,
} from "../choice-stepper/choice-options";
import type {
  NaturalConditionDimension,
  NaturalConditionTag,
  NaturalInterpretation,
  NaturalInterpretationOverrideChange,
  NaturalInterpretationOverrides,
} from "./natural-language";

const MEDIA_TYPE_OPTIONS = [
  { value: "MOVIE", label: "영화" },
  { value: "SERIES", label: "시리즈" },
  { value: "ANY", label: "영화·시리즈 모두" },
] as const satisfies ReadonlyArray<{
  value: MediaTypePreference;
  label: string;
}>;

const COMPANION_OPTIONS = [
  ...WHO_OPTIONS.map(({ value, label }) => ({ value, label })),
  NO_COMPANION_OPTION,
];

const UNLIMITED_VALUE = "UNLIMITED";
const ALL_PROVIDERS_VALUE = "ALL_PROVIDERS";
const NO_GENRE_VALUE = "NO_GENRE";
const SELECT_CLASS_NAME =
  "mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-slate-600 bg-[#10151b] px-3 text-sm font-bold text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20";

function isDimensionOverridden(
  dimension: NaturalConditionDimension,
  overrides: NaturalInterpretationOverrides,
) {
  switch (dimension) {
    case "동반자":
      return overrides.who !== undefined;
    case "작품 유형":
      return overrides.mediaType !== undefined;
    case "시간":
      return overrides.runtimeMinutes !== undefined;
    case "OTT":
      return overrides.providers !== undefined;
    case "느낌":
      return overrides.mood !== undefined;
    case "제작 지역":
      return overrides.origin !== undefined;
    case "장르":
      return overrides.genres !== undefined;
  }
}

function SettingEditor({
  tag,
  interpretation,
  onChange,
}: {
  tag: NaturalConditionTag;
  interpretation: NaturalInterpretation;
  onChange: (change: NaturalInterpretationOverrideChange) => void;
}) {
  const label = (
    <span className="flex items-center justify-between gap-2 text-sm font-bold text-slate-400">
      <span>{tag.dimension}</span>
      {tag.source === "USER_EDITED" ? (
        <span className="text-orange-300">수정됨</span>
      ) : null}
    </span>
  );

  switch (tag.dimension) {
    case "동반자":
      return (
        <label className="block">
          {label}
          <select
            value={interpretation.draft.who ?? "ANY"}
            className={SELECT_CLASS_NAME}
            onChange={(event) => {
              const selected = COMPANION_OPTIONS.find(
                (option) => option.value === event.target.value,
              );
              if (selected) onChange({ dimension: "who", value: selected.value });
            }}
          >
            {COMPANION_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    case "작품 유형":
      return (
        <label className="block">
          {label}
          <select
            value={interpretation.mediaType}
            className={SELECT_CLASS_NAME}
            onChange={(event) => {
              const selected = MEDIA_TYPE_OPTIONS.find(
                (option) => option.value === event.target.value,
              );
              if (selected) {
                onChange({ dimension: "mediaType", value: selected.value });
              }
            }}
          >
            {MEDIA_TYPE_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    case "시간": {
      const runtimeValue =
        interpretation.runtimeMinutes === null
          ? UNLIMITED_VALUE
          : String(interpretation.runtimeMinutes);
      return (
        <label className="block">
          {label}
          <select
            value={runtimeValue}
            className={SELECT_CLASS_NAME}
            onChange={(event) => {
              const selected = DURATION_OPTIONS.find((option) =>
                option.value === null
                  ? event.target.value === UNLIMITED_VALUE
                  : String(option.value) === event.target.value,
              );
              if (selected) {
                onChange({
                  dimension: "runtimeMinutes",
                  value: selected.value,
                });
              }
            }}
          >
            {DURATION_OPTIONS.map((option) => (
              <option
                value={
                  option.value === null ? UNLIMITED_VALUE : String(option.value)
                }
                key={option.label}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    }
    case "OTT": {
      const allProvidersSelected =
        interpretation.draft.otts.length === OTT_OPTIONS.length &&
        OTT_OPTIONS.every((option) =>
          interpretation.draft.otts.includes(option.value),
        );
      const providerValue = allProvidersSelected
        ? ALL_PROVIDERS_VALUE
        : (interpretation.draft.otts[0] ?? ALL_PROVIDERS_VALUE);
      return (
        <label className="block">
          {label}
          <select
            value={providerValue}
            className={SELECT_CLASS_NAME}
            onChange={(event) => {
              if (event.target.value === ALL_PROVIDERS_VALUE) {
                onChange({
                  dimension: "providers",
                  value: OTT_OPTIONS.map((option) => option.value),
                });
                return;
              }
              const selected = OTT_OPTIONS.find(
                (option) => option.value === event.target.value,
              );
              if (selected) {
                onChange({ dimension: "providers", value: [selected.value] });
              }
            }}
          >
            <option value={ALL_PROVIDERS_VALUE}>모든 지원 OTT</option>
            {OTT_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    }
    case "느낌":
      return (
        <label className="block">
          {label}
          <select
            value={interpretation.draft.mood ?? "ANY"}
            className={SELECT_CLASS_NAME}
            onChange={(event) => {
              const selected = MOOD_OPTIONS.find(
                (option) => option.value === event.target.value,
              );
              if (selected) onChange({ dimension: "mood", value: selected.value });
            }}
          >
            {MOOD_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    case "제작 지역":
      return (
        <label className="block">
          {label}
          <select
            value={interpretation.draft.origin ?? "ANY"}
            className={SELECT_CLASS_NAME}
            onChange={(event) => {
              const selected = ORIGIN_OPTIONS.find(
                (option) => option.value === event.target.value,
              );
              if (selected) {
                onChange({ dimension: "origin", value: selected.value });
              }
            }}
          >
            {ORIGIN_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    case "장르": {
      const genreValue = interpretation.draft.genres[0] ?? NO_GENRE_VALUE;
      return (
        <label className="block">
          {label}
          <select
            value={genreValue}
            className={SELECT_CLASS_NAME}
            onChange={(event) => {
              if (event.target.value === NO_GENRE_VALUE) {
                onChange({ dimension: "genres", value: [] });
                return;
              }
              const selected = GENRE_OPTIONS.find(
                (option) => option.value === event.target.value,
              );
              if (selected) {
                onChange({ dimension: "genres", value: [selected.value] });
              }
            }}
          >
            <option value={NO_GENRE_VALUE}>장르 제한 없음</option>
            {GENRE_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    }
  }
}

export function NaturalConditionSummary({
  interpretation,
  editableDefaults = false,
  overrides = {},
  onOverrideChange,
  className = "",
}: {
  interpretation: NaturalInterpretation;
  editableDefaults?: boolean;
  overrides?: NaturalInterpretationOverrides;
  onOverrideChange?: (change: NaturalInterpretationOverrideChange) => void;
  className?: string;
}) {
  const statedTags = interpretation.tags.filter(
    (tag) => tag.source !== "DEFAULT",
  );
  const defaultTags = interpretation.tags.filter(
    (tag) => tag.source === "DEFAULT",
  );
  const overrideChangeHandler = editableDefaults ? onOverrideChange : undefined;
  const editedSettingTags = overrideChangeHandler
    ? interpretation.tags.filter(
        (tag) =>
          tag.source === "USER_EDITED" &&
          tag.dimension !== "작품 유형" &&
          isDimensionOverridden(tag.dimension, overrides),
      )
    : [];
  const editableDimensions = new Set(
    editedSettingTags.map((tag) => tag.dimension),
  );
  const settingTags = overrideChangeHandler
    ? interpretation.tags.filter(
        (tag) =>
          tag.source === "DEFAULT" || editableDimensions.has(tag.dimension),
      )
    : defaultTags;
  const canEditMediaType =
    overrideChangeHandler &&
    statedTags.some((tag) => tag.dimension === "작품 유형");

  return (
    <section
      className={`rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6 ${className}`}
      aria-labelledby="interpreted-condition-title"
    >
      <p className="choice-stepper__eyebrow">이렇게 이해했어요</p>
      <h2 id="interpreted-condition-title" className="sr-only">
        문장에서 이해한 추천 조건
      </h2>

      {statedTags.length ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="직접 말한 추천 조건">
          {statedTags.map((tag) => (
            <li
              key={tag.dimension}
              data-condition-source={tag.source.toLowerCase()}
              className="inline-flex min-h-10 items-center rounded-full border border-orange-500/35 bg-orange-500/10 px-3 py-1.5 text-sm font-bold leading-6 text-orange-100"
            >
              {tag.label}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-300">
          문장에서 확정할 조건이 없어 기본 설정으로 이해했어요.
        </p>
      )}

      {canEditMediaType ? (
        <label className="mt-4 flex max-w-sm flex-wrap items-center gap-2 text-sm font-bold text-slate-300">
          <span>작품 유형 수정</span>
          <select
            value={interpretation.mediaType}
            className="min-h-10 flex-1 rounded-full border border-slate-600 bg-[#10151b] px-4 text-sm font-bold text-white outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20"
            onChange={(event) => {
              const selected = MEDIA_TYPE_OPTIONS.find(
                (option) => option.value === event.target.value,
              );
              if (selected && overrideChangeHandler) {
                overrideChangeHandler({
                  dimension: "mediaType",
                  value: selected.value,
                });
              }
            }}
          >
            {MEDIA_TYPE_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {settingTags.length ? (
        <details className="mt-4 border-t border-white/10 pt-4 text-sm text-slate-300">
          <summary className="min-h-10 cursor-pointer list-none py-2 font-bold text-slate-300 marker:hidden hover:text-white">
            기본 설정 {defaultTags.length}개
            {editedSettingTags.length
              ? ` · 수정한 설정 ${editedSettingTags.length}개`
              : ""}{" "}
            {overrideChangeHandler ? "수정" : "보기"}{" "}
            <span aria-hidden="true">▾</span>
          </summary>
          <ul
            className="mt-2 grid gap-2 sm:grid-cols-2"
            aria-label={
              overrideChangeHandler ? "기본 설정 수정" : "시스템 기본 설정"
            }
          >
            {settingTags.map((tag) => (
              <li
                key={tag.dimension}
                data-condition-source={tag.source.toLowerCase()}
                className="min-w-0 rounded-xl border border-slate-700 bg-slate-900/55 px-3 py-3 leading-6"
              >
                {overrideChangeHandler ? (
                  <SettingEditor
                    tag={tag}
                    interpretation={interpretation}
                    onChange={overrideChangeHandler}
                  />
                ) : (
                  <>
                    <span className="mr-1 text-slate-500">{tag.dimension}:</span>
                    {tag.label}
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
