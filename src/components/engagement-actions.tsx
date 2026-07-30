"use client";

import { useEffect, useState } from "react";
import type { EngagementType } from "@/contracts/engagement";
import type { UserContext } from "@/contracts/user";

type EngagementActionsProps = {
  contentId: string;
  runId?: string;
  compact?: boolean;
};

export function EngagementActions({
  contentId,
  runId,
  compact = false,
}: EngagementActionsProps) {
  const [bookmarked, setBookmarked] = useState(false);
  const [feedback, setFeedback] = useState<"WATCHED" | "NOT_INTERESTED" | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<EngagementType | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadState() {
      try {
        const response = await fetch("/api/users/profile", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("저장 상태를 불러오지 못했어요.");
        }

        const profile = (await response.json()) as UserContext;
        const notInterested = profile.notInterestedContentIds.includes(contentId);
        const watched = profile.watchedContentIds.includes(contentId);
        setBookmarked(
          !notInterested && profile.bookmarkedContentIds.includes(contentId),
        );
        setFeedback(notInterested ? "NOT_INTERESTED" : watched ? "WATCHED" : null);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setMessage(
            loadError instanceof Error
              ? loadError.message
              : "저장 상태를 불러오지 못했어요.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setHydrated(true);
        }
      }
    }

    void loadState();
    return () => controller.abort();
  }, [contentId]);

  async function record(type: EngagementType) {
    setPending(type);
    setMessage("");
    try {
      const response = await fetch("/api/engagement", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentId, runId, type }),
      });
      if (!response.ok) throw new Error("피드백을 저장하지 못했어요.");

      if (type === "BOOKMARK") {
        setBookmarked(true);
        setMessage("찜에 담았어요.");
      } else if (type === "UNBOOKMARK") {
        setBookmarked(false);
        setMessage("찜에서 뺐어요.");
      } else if (type === "WATCHED") {
        setFeedback("WATCHED");
        setMessage("봤어요에 기록했어요.");
      } else if (type === "NOT_INTERESTED") {
        setFeedback("NOT_INTERESTED");
        setBookmarked(false);
        setMessage("다음 추천에서 제외할게요.");
      }
    } catch (recordError) {
      setMessage(
        recordError instanceof Error
          ? recordError.message
          : "피드백을 저장하지 못했어요.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div
      className={`engagement${compact ? " engagement--compact" : ""}`}
      aria-busy={!hydrated || pending !== null}
    >
      <div className="engagement__buttons">
        <button
          type="button"
          className={bookmarked ? "is-active" : undefined}
          aria-pressed={bookmarked}
          disabled={
            !hydrated || pending !== null || feedback === "NOT_INTERESTED"
          }
          onClick={() => record(bookmarked ? "UNBOOKMARK" : "BOOKMARK")}
        >
          <span aria-hidden="true">{bookmarked ? "♥" : "♡"}</span>
          {bookmarked ? "찜 완료" : "찜하기"}
        </button>
        <button
          type="button"
          className={feedback === "WATCHED" ? "is-active" : undefined}
          aria-pressed={feedback === "WATCHED"}
          disabled={!hydrated || pending !== null || feedback !== null}
          onClick={() => {
            if (feedback === null) void record("WATCHED");
          }}
        >
          <span aria-hidden="true">✓</span>
          {feedback === "WATCHED" ? "봤어요 기록됨" : "봤어요"}
        </button>
        <button
          type="button"
          className={feedback === "NOT_INTERESTED" ? "is-active" : undefined}
          aria-pressed={feedback === "NOT_INTERESTED"}
          disabled={!hydrated || pending !== null || feedback !== null}
          onClick={() => {
            if (feedback === null) void record("NOT_INTERESTED");
          }}
        >
          <span aria-hidden="true">×</span>
          {feedback === "NOT_INTERESTED" ? "관심 없음 기록됨" : "관심 없음"}
        </button>
      </div>
      <span className="engagement__message" aria-live="polite">
        {!hydrated ? "저장 상태 확인 중…" : pending ? "저장 중…" : message}
      </span>
    </div>
  );
}
