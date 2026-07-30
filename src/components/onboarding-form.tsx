"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { OttProvider, UserContext } from "@/contracts/user";
import { OTT_PROVIDERS } from "@/contracts/user";
import { ProviderBadge, providerLabels } from "./provider-badge";

const genreOptions = [
  "코미디",
  "드라마",
  "미스터리",
  "스릴러",
  "로맨스",
  "SF",
  "애니메이션",
  "다큐멘터리",
];

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function getAge(birthDate: string) {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function OnboardingForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [displayName, setDisplayName] = useState("김민지");
  const [birthDate, setBirthDate] = useState("1997-05-18");
  const [ageConfirmed, setAgeConfirmed] = useState(true);
  const [providers, setProviders] = useState<OttProvider[]>([
    "NETFLIX",
    "TVING",
    "DISNEY_PLUS",
  ]);
  const [preferredGenres, setPreferredGenres] = useState<string[]>([
    "미스터리",
    "코미디",
  ]);
  const [dislikedGenres, setDislikedGenres] = useState<string[]>(["공포"]);
  const [allowUnsubscribed, setAllowUnsubscribed] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const age = useMemo(() => getAge(birthDate), [birthDate]);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/users/profile", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("저장된 프로필을 불러오지 못했어요.");
        }
        return (await response.json()) as UserContext;
      })
      .then((profile) => {
        if (cancelled) return;
        setDisplayName(profile.displayName);
        setBirthDate(profile.birthDate);
        setAgeConfirmed(profile.age >= 14);
        setProviders(profile.subscribedProviders);
        setPreferredGenres(profile.preferredGenres);
        setDislikedGenres(profile.dislikedGenres);
        setAllowUnsubscribed(profile.allowUnsubscribedRecommendations);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "저장된 프로필을 불러오지 못했어요.",
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function goNext() {
    if (!displayName.trim()) {
      setError("닉네임을 입력해 주세요.");
      return;
    }
    if (!birthDate || age < 14 || !ageConfirmed) {
      setError("만 14세 이상 확인과 올바른 생년월일이 필요해요.");
      return;
    }
    setError("");
    setStep(2);
  }

  async function saveProfile() {
    if (providers.length === 0) {
      setError("구독 중인 OTT를 하나 이상 골라 주세요.");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          birthDate,
          subscribedProviders: providers,
          preferredGenres,
          dislikedGenres,
          allowUnsubscribedRecommendations: allowUnsubscribed,
        }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(result?.error ?? "프로필을 저장하지 못했어요.");
      }
      router.push("/choice");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "프로필을 저장하지 못했어요.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="onboarding-card result-loading" role="status">
        <span className="result-loading__mark" aria-hidden="true">
          D
        </span>
        <p>저장된 프로필을 불러오는 중이에요.</p>
      </div>
    );
  }

  return (
    <div className="onboarding-card">
      <div className="step-progress" aria-label={`온보딩 ${step}/2 단계`}>
        <div>
          <span className="is-complete">1</span>
          <strong className={step === 1 ? "is-current" : ""}>기본 프로필</strong>
        </div>
        <i className={step === 2 ? "is-complete" : ""} />
        <div>
          <span className={step === 2 ? "is-active" : ""}>2</span>
          <strong className={step === 2 ? "is-current" : ""}>OTT와 취향</strong>
        </div>
      </div>

      {step === 1 ? (
        <section className="onboarding-step" aria-labelledby="profile-step-title">
          <div className="form-section-heading">
            <span className="section-number">01</span>
            <div>
              <h2 id="profile-step-title">어떻게 불러드릴까요?</h2>
              <p>생년월일은 연령 등급을 확인할 때만 사용합니다.</p>
            </div>
          </div>
          <label className="field">
            <span>닉네임</span>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={20}
              autoComplete="nickname"
            />
          </label>
          <label className="field">
            <span>생년월일</span>
            <input
              type="date"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              autoComplete="bday"
            />
            {birthDate ? <small>현재 기준 만 {age}세로 확인돼요.</small> : null}
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(event) => setAgeConfirmed(event.target.checked)}
            />
            <span>
              <strong>만 14세 이상입니다.</strong>
              <small>Demo도 실제 정책과 같은 기준으로 확인해요.</small>
            </span>
          </label>
        </section>
      ) : (
        <section className="onboarding-step" aria-labelledby="ott-step-title">
          <div className="form-section-heading">
            <span className="section-number">02</span>
            <div>
              <h2 id="ott-step-title">볼 수 있는 OTT를 알려주세요</h2>
              <p>선택한 서비스에서 국내 제공되는 작품을 우선 추천해요.</p>
            </div>
          </div>
          <fieldset className="field-group">
            <legend>구독 중인 OTT</legend>
            <div className="provider-choice-grid">
              {OTT_PROVIDERS.map((provider) => (
                <label
                  className={`provider-choice${
                    providers.includes(provider) ? " is-selected" : ""
                  }`}
                  key={provider}
                >
                  <input
                    type="checkbox"
                    checked={providers.includes(provider)}
                    onChange={() => setProviders(toggleValue(providers, provider))}
                  />
                  <ProviderBadge provider={provider} compact />
                  <span>{providerLabels[provider]}</span>
                  <i aria-hidden="true">✓</i>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="preference-columns">
            <fieldset className="field-group">
              <legend>좋아하는 장르 <small>선택</small></legend>
              <div className="chip-grid chip-grid--compact">
                {genreOptions.map((genre) => (
                  <label
                    className={`choice-chip${
                      preferredGenres.includes(genre) ? " is-selected" : ""
                    }`}
                    key={genre}
                  >
                    <input
                      type="checkbox"
                      checked={preferredGenres.includes(genre)}
                      onChange={() =>
                        setPreferredGenres(toggleValue(preferredGenres, genre))
                      }
                    />
                    {genre}
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="field-group">
              <legend>피하고 싶은 장르 <small>선택</small></legend>
              <div className="chip-grid chip-grid--compact">
                {genreOptions.map((genre) => (
                  <label
                    className={`choice-chip choice-chip--avoid${
                      dislikedGenres.includes(genre) ? " is-selected" : ""
                    }`}
                    key={genre}
                  >
                    <input
                      type="checkbox"
                      checked={dislikedGenres.includes(genre)}
                      onChange={() =>
                        setDislikedGenres(toggleValue(dislikedGenres, genre))
                      }
                    />
                    {genre}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <label className="toggle-row">
            <span>
              <strong>미구독 OTT 작품도 함께 볼게요</strong>
              <small>꺼두면 구독 중인 OTT 작품만 추천합니다.</small>
            </span>
            <input
              type="checkbox"
              checked={allowUnsubscribed}
              onChange={(event) => setAllowUnsubscribed(event.target.checked)}
            />
          </label>
        </section>
      )}

      <div className="form-feedback" aria-live="polite">
        {error ? <p className="form-error">{error}</p> : null}
      </div>
      <div className="onboarding-actions">
        {step === 2 ? (
          <button className="button button--ghost" onClick={() => setStep(1)}>
            이전
          </button>
        ) : (
          <span />
        )}
        {step === 1 ? (
          <button className="button button--primary" onClick={goNext}>
            다음: OTT 선택 <span aria-hidden="true">→</span>
          </button>
        ) : (
          <button
            className="button button--primary"
            onClick={saveProfile}
            disabled={isSaving}
          >
            {isSaving ? "저장 중…" : "저장하고 추천받기"}
            {!isSaving ? <span aria-hidden="true">→</span> : null}
          </button>
        )}
      </div>
    </div>
  );
}
