"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import type { CatalogContent } from "@/contracts/catalog";
import type { EngagementEvent } from "@/contracts/engagement";
import type { RecommendationResponse } from "@/contracts/recommendation";
import type { UserContext } from "@/contracts/user";
import { PosterArt } from "./poster-art";
import { ProviderBadge } from "./provider-badge";

type Tab = "bookmarks" | "watched" | "not_interested" | "runs";

type LibraryPayload = {
  events: EngagementEvent[];
  contents: CatalogContent[];
};

type RunsPayload = {
  runs: RecommendationResponse[];
};

const tabs: Array<{ id: Tab; label: string; icon: string }> = [
  { id: "bookmarks", label: "찜", icon: "♡" },
  { id: "watched", label: "봤어요", icon: "✓" },
  { id: "not_interested", label: "관심 없음", icon: "×" },
  { id: "runs", label: "최근 추천", icon: "↻" },
];

function latestEvents(events: EngagementEvent[]) {
  const map = new Map<string, EngagementEvent[]>();
  for (const event of events) {
    const previous = map.get(event.contentId) ?? [];
    previous.push(event);
    map.set(event.contentId, previous);
  }
  return map;
}

export function MyView() {
  const [tab, setTab] = useState<Tab>("bookmarks");
  const [profile, setProfile] = useState<UserContext | null>(null);
  const [library, setLibrary] = useState<LibraryPayload>({
    events: [],
    contents: [],
  });
  const [runs, setRuns] = useState<RecommendationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const load = useCallback(async () => {
    try {
      const [profileResponse, libraryResponse, runsResponse] = await Promise.all([
        fetch("/api/users/profile", { cache: "no-store" }),
        fetch("/api/engagement", { cache: "no-store" }),
        fetch("/api/recommendations", { cache: "no-store" }),
      ]);
      if (!profileResponse.ok || !libraryResponse.ok || !runsResponse.ok) {
        throw new Error("MY 데이터를 불러오지 못했어요.");
      }
      const [profileResult, libraryResult, runsResult] = await Promise.all([
        profileResponse.json() as Promise<UserContext>,
        libraryResponse.json() as Promise<LibraryPayload>,
        runsResponse.json() as Promise<RunsPayload>,
      ]);
      setProfile(profileResult);
      setLibrary(libraryResult);
      setRuns(runsResult.runs ?? []);
    } catch (loadError) {
      setMessage(
        loadError instanceof Error
          ? loadError.message
          : "MY 데이터를 불러오지 못했어요.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const requests = Promise.all([
      fetch("/api/users/profile", { cache: "no-store" }),
      fetch("/api/engagement", { cache: "no-store" }),
      fetch("/api/recommendations", { cache: "no-store" }),
    ]);

    void requests
      .then(async ([profileResponse, libraryResponse, runsResponse]) => {
        if (!profileResponse.ok || !libraryResponse.ok || !runsResponse.ok) {
          throw new Error("MY 데이터를 불러오지 못했어요.");
        }
        return Promise.all([
          profileResponse.json() as Promise<UserContext>,
          libraryResponse.json() as Promise<LibraryPayload>,
          runsResponse.json() as Promise<RunsPayload>,
        ]);
      })
      .then(([profileResult, libraryResult, runsResult]) => {
        if (ignore) return;
        setProfile(profileResult);
        setLibrary(libraryResult);
        setRuns(runsResult.runs ?? []);
      })
      .catch((loadError: unknown) => {
        if (ignore) return;
        setMessage(
          loadError instanceof Error
            ? loadError.message
            : "MY 데이터를 불러오지 못했어요.",
        );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  const categorized = useMemo(() => {
    const eventsByContent = latestEvents(library.events);
    const bookmarks: CatalogContent[] = [];
    const watched: CatalogContent[] = [];
    const notInterested: CatalogContent[] = [];

    for (const content of library.contents) {
      const events = eventsByContent.get(content.id) ?? [];
      const bookmarkEvents = events.filter(
        (event) => event.type === "BOOKMARK" || event.type === "UNBOOKMARK",
      );
      if (bookmarkEvents.at(-1)?.type === "BOOKMARK") bookmarks.push(content);
      if (events.some((event) => event.type === "WATCHED")) watched.push(content);
      if (events.some((event) => event.type === "NOT_INTERESTED")) {
        notInterested.push(content);
      }
    }
    return { bookmarks, watched, notInterested };
  }, [library]);

  const visibleContents =
    tab === "bookmarks"
      ? categorized.bookmarks
      : tab === "watched"
        ? categorized.watched
        : categorized.notInterested;

  async function resetDemo() {
    const confirmed = window.confirm(
      "찜·봤어요·추천 기록을 모두 초기화할까요? 이 작업은 되돌릴 수 없어요.",
    );
    if (!confirmed) return;
    setMessage("Demo 데이터를 초기화하는 중…");
    try {
      const response = await fetch("/api/demo/reset", { method: "POST" });
      if (!response.ok) throw new Error("초기화하지 못했어요.");
      setTab("bookmarks");
      await load();
      setMessage("Demo 데이터를 초기화했어요.");
    } catch (resetError) {
      setMessage(
        resetError instanceof Error
          ? resetError.message
          : "초기화하지 못했어요.",
      );
    }
  }

  function moveTabFocus(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : event.key === "ArrowRight"
            ? (index + 1) % tabs.length
            : (index - 1 + tabs.length) % tabs.length;
    setTab(tabs[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="my-layout">
      <section className="profile-overview">
        <div className="profile-overview__identity">
          <div className="profile-avatar">{profile?.displayName?.[0] ?? "민"}</div>
          <div>
            <p className="eyebrow">MY DAMOA</p>
            <h1>{profile?.displayName ?? "김민지"}님의 보관함</h1>
            <p>고른 기록이 다음 추천의 필수 제외 조건으로 이어져요.</p>
          </div>
        </div>
        <div className="profile-overview__providers">
          <span>구독 OTT</span>
          <div>
            {(profile?.subscribedProviders ?? [
              "NETFLIX",
              "TVING",
              "DISNEY_PLUS",
            ]).map((provider) => (
              <ProviderBadge provider={provider} compact key={provider} />
            ))}
          </div>
        </div>
        <Link href="/onboarding" className="button button--ghost">
          프로필 수정
        </Link>
      </section>

      <section className="my-stats" aria-label="Demo 활동 요약">
        <div>
          <span className="my-stat-icon my-stat-icon--pink" aria-hidden="true">
            ♡
          </span>
          <p>
            <strong>{categorized.bookmarks.length}</strong>
            <span>찜한 작품</span>
          </p>
        </div>
        <div>
          <span className="my-stat-icon my-stat-icon--teal" aria-hidden="true">
            ✓
          </span>
          <p>
            <strong>{categorized.watched.length}</strong>
            <span>본 작품</span>
          </p>
        </div>
        <div>
          <span className="my-stat-icon my-stat-icon--violet" aria-hidden="true">
            ✦
          </span>
          <p>
            <strong>{runs.length}</strong>
            <span>추천 실행</span>
          </p>
        </div>
        <div>
          <span className="my-stat-icon my-stat-icon--amber" aria-hidden="true">
            ◇
          </span>
          <p>
            <strong>
              {runs.reduce(
                (sum, run) =>
                  sum +
                  (run.status === "completed" ? run.policyBlockedCount : 0),
                0,
              )}
            </strong>
            <span>정책 차단</span>
          </p>
        </div>
      </section>

      <section className="library-panel">
        <div className="library-tabs" role="tablist" aria-label="MY 보관함">
          {tabs.map((item, index) => (
            <button
              type="button"
              role="tab"
              id={`library-tab-${item.id}`}
              aria-controls="library-panel"
              aria-selected={tab === item.id}
              tabIndex={tab === item.id ? 0 : -1}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              onKeyDown={(event) => moveTabFocus(event, index)}
              className={tab === item.id ? "is-active" : undefined}
              onClick={() => setTab(item.id)}
              key={item.id}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
              <small>
                {item.id === "bookmarks"
                  ? categorized.bookmarks.length
                  : item.id === "watched"
                    ? categorized.watched.length
                    : item.id === "not_interested"
                      ? categorized.notInterested.length
                      : runs.length}
              </small>
            </button>
          ))}
        </div>

        <div
          className="library-content"
          id="library-panel"
          role="tabpanel"
          aria-labelledby={`library-tab-${tab}`}
          tabIndex={0}
        >
          <span className="sr-only" aria-live="polite">
            {message}
          </span>
          {loading ? (
            <div className="library-loading" role="status">
              보관함을 불러오는 중…
            </div>
          ) : message && !profile ? (
            <div className="empty-state">
              <span aria-hidden="true">!</span>
              <h2>보관함을 불러오지 못했어요.</h2>
              <p>{message}</p>
              <button
                className="button button--ghost"
                onClick={() => {
                  setLoading(true);
                  void load();
                }}
              >
                다시 시도
              </button>
            </div>
          ) : tab === "runs" ? (
            runs.length ? (
              <div className="run-list">
                {runs.map((run, index) => (
                  <Link
                    href={`/recommendations/${encodeURIComponent(run.runId)}`}
                    className="run-card"
                    key={run.runId}
                  >
                    <span className="run-card__number">{index + 1}</span>
                    <div>
                      <strong>
                        {run.status === "completed"
                          ? `${run.recommendations.length}편 추천`
                          : "조건 확장 승인 대기"}
                      </strong>
                      <p>
                        {run.status === "completed" && run.topPick
                          ? `TOP1 · ${run.topPick.content.title}`
                          : "30분 조건을 유지하고 있어요"}
                      </p>
                    </div>
                    <span
                      className={`status-chip${
                        run.status === "completed" && run.fallbackUsed
                          ? " status-chip--fallback"
                          : run.status === "completed" &&
                              run.policyBlockedCount > 0
                            ? " status-chip--safe"
                            : ""
                      }`}
                    >
                      {run.status === "awaiting_approval"
                        ? "승인 대기"
                        : run.fallbackUsed
                          ? "빠른 추천"
                          : run.policyBlockedCount > 0
                            ? "정책 적용"
                            : "완료"}
                    </span>
                    <i aria-hidden="true">→</i>
                  </Link>
                ))}
              </div>
            ) : (
              <LibraryEmpty
                title="아직 추천 기록이 없어요."
                description="지금 기분을 골라 첫 5편을 받아보세요."
              />
            )
          ) : visibleContents.length ? (
            <div className="library-grid">
              {visibleContents.map((content) => (
                <article className="library-card" key={content.id}>
                  <PosterArt content={content} />
                  <div>
                    <div>
                      {content.providers.slice(0, 2).map((provider) => (
                        <ProviderBadge
                          provider={provider.provider}
                          compact
                          key={provider.provider}
                        />
                      ))}
                    </div>
                    <h3>{content.title}</h3>
                    <p>
                      {content.releaseYear} · {content.runtimeMinutes}분 ·{" "}
                      {content.genres.slice(0, 2).join(", ")}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <LibraryEmpty
              title={
                tab === "bookmarks"
                  ? "아직 찜한 작품이 없어요."
                  : tab === "watched"
                    ? "본 작품을 표시해 보세요."
                    : "관심 없음으로 표시한 작품이 없어요."
              }
              description="추천 결과 카드에서 바로 기록할 수 있어요."
            />
          )}
        </div>
      </section>

      <section className="demo-danger-zone">
        <div>
          <strong>Demo 데이터 초기화</strong>
          <p>추천 실행과 모든 참여 기록을 처음 상태로 되돌립니다.</p>
        </div>
        <button className="button button--danger-ghost" onClick={resetDemo}>
          기록 초기화
        </button>
      </section>
    </div>
  );
}

function LibraryEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state empty-state--library">
      <span aria-hidden="true">♡</span>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link href="/choice" className="button button--primary">
        새 추천 받기
      </Link>
    </div>
  );
}
