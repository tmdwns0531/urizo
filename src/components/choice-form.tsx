"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Companion, OriginPreference } from "@/contracts/search";
import type {
  DemoScenario,
  RecommendationRequest,
} from "@/contracts/recommendation";
import { ProviderBadge } from "./provider-badge";

const companionOptions: Array<{
  value: Companion;
  label: string;
  icon: string;
}> = [
  { value: "ALONE", label: "혼자", icon: "●" },
  { value: "PARTNER", label: "연인과", icon: "♥" },
  { value: "FRIENDS", label: "친구와", icon: "♣" },
  { value: "FAMILY", label: "가족과", icon: "⌂" },
  { value: "WITH_CHILDREN", label: "아이와", icon: "✦" },
  { value: "ANY", label: "상관없음", icon: "∞" },
];

const moodOptions = [
  { value: "밝은", label: "즐겁게 웃고 싶어요", icon: "☀" },
  { value: "따뜻한", label: "위로받고 싶어요", icon: "♡" },
  { value: "감성적인", label: "감성에 젖고 싶어요", icon: "☂" },
  { value: "어두운", label: "어둡고 진한 게 좋아요", icon: "◐" },
  { value: "긴장감 있는", label: "긴장감을 느끼고 싶어요", icon: "⚡" },
  { value: "잔잔한", label: "편안하게 보고 싶어요", icon: "⌁" },
  {
    value: "생각할 거리가 있는",
    label: "생각할 거리가 있으면 좋겠어요",
    icon: "◇",
  },
  { value: "자극적인", label: "자극적인 게 당겨요", icon: "✺" },
];

const runtimeOptions = [
  { value: 30, label: "30분", hint: "짧게" },
  { value: 60, label: "1시간", hint: "가볍게" },
  { value: 120, label: "2시간", hint: "영화 한 편" },
  { value: 180, label: "3시간", hint: "여유롭게" },
  { value: null, label: "상관없음", hint: "길이 무관" },
] as const;

const originOptions: Array<{
  value: OriginPreference;
  label: string;
  hint: string;
}> = [
  { value: "KR", label: "한국 작품", hint: "공동제작 포함" },
  { value: "NON_KR", label: "해외 작품", hint: "한국 외 제작" },
  { value: "ANY", label: "상관없음", hint: "모두 보기" },
];

const scenarioOptions: Array<{
  value: DemoScenario;
  label: string;
  description: string;
  tone: string;
}> = [
  {
    value: "normal",
    label: "기본 추천",
    description: "조건을 지킨 TOP 5",
    tone: "blue",
  },
  {
    value: "approval",
    label: "승인 게이트",
    description: "30분 → 45분 제안",
    tone: "violet",
  },
  {
    value: "policy_block",
    label: "정책 차단",
    description: "연령 부적합 후보 제거",
    tone: "teal",
  },
  {
    value: "budget_fallback",
    label: "예산 폴백",
    description: "규칙 기반 추천 전환",
    tone: "amber",
  },
];

const avoidGenreOptions = ["공포", "액션", "로맨스", "범죄", "다큐멘터리"];

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function ChoiceForm() {
  const router = useRouter();
  const [companion, setCompanion] = useState<Companion>("ALONE");
  const [moods, setMoods] = useState<string[]>(["긴장감 있는"]);
  const [maxRuntime, setMaxRuntime] = useState<number | null>(120);
  const [runtimeBeforeApproval, setRuntimeBeforeApproval] =
    useState<number | null>(120);
  const [origin, setOrigin] = useState<OriginPreference>("ANY");
  const [naturalLanguage, setNaturalLanguage] = useState("");
  const [avoidGenre, setAvoidGenre] = useState("");
  const [scenario, setScenario] = useState<DemoScenario>("normal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedScenario = useMemo(
    () => scenarioOptions.find((item) => item.value === scenario)!,
    [scenario],
  );

  function selectScenario(value: DemoScenario) {
    if (value === "approval" && scenario !== "approval") {
      setRuntimeBeforeApproval(maxRuntime);
      setMaxRuntime(30);
    } else if (scenario === "approval" && value !== "approval") {
      setMaxRuntime(runtimeBeforeApproval);
    }
    setScenario(value);
  }

  async function submitRecommendation() {
    setIsSubmitting(true);
    setError("");

    const request: RecommendationRequest = {
      scenario,
      choice: {
        companions: [companion],
        moods,
        maxRuntimeMinutes: scenario === "approval" ? 30 : maxRuntime,
        originPreference: origin,
        naturalLanguage: naturalLanguage.trim(),
        companionAvoidGenres: avoidGenre ? [avoidGenre] : [],
      },
    };

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const result = (await response.json().catch(() => null)) as
        | { runId?: string; error?: string }
        | null;
      if (!response.ok || !result?.runId) {
        throw new Error(result?.error ?? "추천을 시작하지 못했어요.");
      }
      router.push(`/recommendations/${encodeURIComponent(result.runId)}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "추천을 시작하지 못했어요.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="choice-layout">
      <div className="choice-main">
        <fieldset className="choice-section">
          <legend>
            <span>01</span>
            <span>
              <strong>누구와 보나요?</strong>
              <small>한 명만 골라 주세요</small>
            </span>
          </legend>
          <div className="choice-card-grid choice-card-grid--six">
            {companionOptions.map((option) => (
              <label
                className={`choice-card${
                  companion === option.value ? " is-selected" : ""
                }`}
                key={option.value}
              >
                <input
                  type="radio"
                  name="companion"
                  value={option.value}
                  checked={companion === option.value}
                  onChange={() => setCompanion(option.value)}
                />
                <span aria-hidden="true">{option.icon}</span>
                <strong>{option.label}</strong>
                <i aria-hidden="true">✓</i>
              </label>
            ))}
          </div>
          {companion === "PARTNER" || companion === "FRIENDS" ? (
            <div className="conditional-field">
              <label htmlFor="avoid-genre">
                상대가 피하는 장르가 있나요? <small>선택 · 1개</small>
              </label>
              <select
                id="avoid-genre"
                value={avoidGenre}
                onChange={(event) => setAvoidGenre(event.target.value)}
              >
                <option value="">없어요</option>
                {avoidGenreOptions.map((genre) => (
                  <option value={genre} key={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </fieldset>

        <fieldset className="choice-section">
          <legend>
            <span>02</span>
            <span>
              <strong>지금 어떤 기분인가요?</strong>
              <small>여러 개 골라도 좋아요</small>
            </span>
          </legend>
          <div className="mood-grid">
            {moodOptions.map((option) => (
              <label
                className={`mood-chip${
                  moods.includes(option.value) ? " is-selected" : ""
                }`}
                key={option.value}
              >
                <input
                  type="checkbox"
                  checked={moods.includes(option.value)}
                  onChange={() => setMoods(toggleValue(moods, option.value))}
                />
                <span aria-hidden="true">{option.icon}</span>
                <strong>{option.label}</strong>
                <i aria-hidden="true">✓</i>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="choice-section-row">
          <fieldset className="choice-section">
            <legend>
              <span>03</span>
              <span>
                <strong>얼마나 볼 수 있나요?</strong>
                <small>시리즈는 회차 기준</small>
              </span>
            </legend>
            <div className="runtime-grid">
              {runtimeOptions.map((option) => (
                <label
                  className={`runtime-card${
                    maxRuntime === option.value ? " is-selected" : ""
                  }${scenario === "approval" ? " is-disabled" : ""}`}
                  key={option.label}
                >
                  <input
                    type="radio"
                    name="runtime"
                    disabled={scenario === "approval"}
                    checked={maxRuntime === option.value}
                    onChange={() => setMaxRuntime(option.value)}
                  />
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="choice-section choice-section--origin">
            <legend>
              <span>04</span>
              <span>
                <strong>어디서 만든 작품이 좋나요?</strong>
                <small>제작 국가 기준</small>
              </span>
            </legend>
            <div className="origin-grid">
              {originOptions.map((option) => (
                <label
                  className={`origin-card${
                    origin === option.value ? " is-selected" : ""
                  }`}
                  key={option.value}
                >
                  <input
                    type="radio"
                    name="origin"
                    checked={origin === option.value}
                    onChange={() => setOrigin(option.value)}
                  />
                  <strong>{option.label}</strong>
                  <small>{option.hint}</small>
                  <i aria-hidden="true">✓</i>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="choice-section natural-query">
          <label htmlFor="natural-query">
            <span className="natural-query__icon" aria-hidden="true">
              “
            </span>
            <span>
              <strong>한마디 더해도 좋아요</strong>
              <small>선택한 조건과 함께 검색에 반영해요</small>
            </span>
          </label>
          <textarea
            id="natural-query"
            value={naturalLanguage}
            onChange={(event) => setNaturalLanguage(event.target.value)}
            placeholder="예: 비 오는 날 혼자 볼 감성적인 한국 영화"
            maxLength={140}
            rows={3}
          />
          <div className="natural-query__meta">
            <span>
              {naturalLanguage.trim()
                ? `이렇게 찾을게요: “${naturalLanguage.trim()}”`
                : "칩 선택만으로도 충분해요."}
            </span>
            <small>{naturalLanguage.length}/140</small>
          </div>
        </div>
      </div>

      <aside className="choice-sidebar">
        <section className="choice-summary">
          <div className="choice-summary__heading">
            <span className="summary-spark" aria-hidden="true">
              ✦
            </span>
            <div>
              <small>YOUR CHOICE</small>
              <h2>이 조건을 그대로 지킬게요</h2>
            </div>
          </div>
          <dl>
            <div>
              <dt>함께</dt>
              <dd>
                {companionOptions.find((item) => item.value === companion)?.label}
              </dd>
            </div>
            <div>
              <dt>기분</dt>
              <dd>{moods.length ? moods.join(", ") : "프로필 기준"}</dd>
            </div>
            <div>
              <dt>시간</dt>
              <dd>
                {scenario === "approval"
                  ? "30분 이내"
                  : maxRuntime
                    ? `${maxRuntime}분 이내`
                    : "상관없음"}
              </dd>
            </div>
            <div>
              <dt>제작</dt>
              <dd>
                {originOptions.find((item) => item.value === origin)?.label}
              </dd>
            </div>
          </dl>
          <div className="summary-providers">
            <span>구독 OTT 안에서</span>
            <div>
              <ProviderBadge provider="NETFLIX" compact />
              <ProviderBadge provider="TVING" compact />
              <ProviderBadge provider="DISNEY_PLUS" compact />
            </div>
          </div>
          <div className="policy-promise">
            <span aria-hidden="true">◇</span>
            <p>
              <strong>조건을 몰래 바꾸지 않아요.</strong>
              결과가 부족하면 먼저 물어봅니다.
            </p>
          </div>
          <button
            className="button button--primary button--block button--large"
            onClick={submitRecommendation}
            disabled={isSubmitting}
          >
            {isSubmitting ? "조건을 확인하는 중…" : "5편 추천받기"}
            {!isSubmitting ? <span aria-hidden="true">→</span> : null}
          </button>
          <div className="submit-feedback" aria-live="polite">
            {error ? <p className="form-error">{error}</p> : null}
          </div>
        </section>

        <fieldset className="demo-lab">
          <legend>
            <span>
              <span className="demo-live-dot" />
              DEMO LAB
            </span>
            <small>핵심 정책 시나리오</small>
          </legend>
          <div className="scenario-list">
            {scenarioOptions.map((option) => (
              <label
                className={`scenario-option scenario-option--${option.tone}${
                  scenario === option.value ? " is-selected" : ""
                }`}
                key={option.value}
              >
                <input
                  type="radio"
                  name="scenario"
                  checked={scenario === option.value}
                  onChange={() => selectScenario(option.value)}
                />
                <span aria-hidden="true" />
                <div>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </div>
                <i aria-hidden="true">✓</i>
              </label>
            ))}
          </div>
          <p className={`scenario-caption scenario-caption--${selectedScenario.tone}`}>
            현재: <strong>{selectedScenario.label}</strong> ·{" "}
            {selectedScenario.description}
          </p>
        </fieldset>
      </aside>
    </div>
  );
}
