"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MvpApprovalDecision as ApprovalDecision,
  MvpAwaitingApprovalRecommendationResponse as AwaitingApprovalRecommendationResponse,
  MvpCompletedRecommendationResponse as CompletedRecommendationResponse,
  MvpRecommendationResponse as RecommendationResponse,
} from "@/contracts/mvp-recommendation";
import { ContentCard } from "./content-card";

type RecommendationViewProps = {
  runId: string;
};

export type ReplacementFeedbackStatus =
  | "pending"
  | "success"
  | "exhausted"
  | "error";

export type ReplacementFeedback = {
  status: ReplacementFeedbackStatus;
  title: string;
  description: string;
};

export const REPLACEMENT_FEEDBACK = {
  pending: {
    status: "pending",
    title: "새 교체 후보를 찾고 있어요.",
    description:
      "현재 카드와 이전에 본 작품을 제외하고 안전 기준을 확인 중이에요.",
  },
  success: {
    status: "success",
    title: "작품을 교체했어요.",
    description: "카드 한 자리만 새 후보로 바꾸고 나머지 결과는 유지했어요.",
  },
  exhausted: {
    status: "exhausted",
    title: "같은 조건의 다른 후보가 없어요.",
    description: "기존 결과는 그대로 유지했어요.",
  },
  error: {
    status: "error",
    title: "교체 요청을 완료하지 못했어요.",
    description:
      "네트워크 연결을 확인한 뒤 다시 시도해 주세요. 기존 결과는 그대로 유지했어요.",
  },
} as const satisfies Record<ReplacementFeedbackStatus, ReplacementFeedback>;

class ReplacementRequestError extends Error {
  constructor(
    readonly feedbackStatus: Extract<
      ReplacementFeedbackStatus,
      "exhausted" | "error"
    >,
    message: string,
  ) {
    super(message);
    this.name = "ReplacementRequestError";
  }
}

export function ReplacementFeedbackNotice({
  feedback,
}: {
  feedback: ReplacementFeedback | null;
}) {
  if (!feedback) return null;

  const icon =
    feedback.status === "pending"
      ? "↻"
      : feedback.status === "success"
        ? "✓"
        : feedback.status === "exhausted"
          ? "i"
          : "!";

  return (
    <aside
      className="result-notice result-notice--neutral"
      data-replacement-state={feedback.status}
    >
      <span aria-hidden="true">{icon}</span>
      <div>
        <strong>{feedback.title}</strong>
        <p>{feedback.description}</p>
      </div>
    </aside>
  );
}

function Timeline({ response }: { response: RecommendationResponse }) {
  return (
    <details className="trace-panel">
      <summary>
        <span className="trace-panel__icon" aria-hidden="true">
          ◇
        </span>
        <span>
          <strong>어떻게 골랐는지 모두 보기</strong>
          <small>{response.trace.length}개의 공개 가능한 실행 기록</small>
        </span>
        <i aria-hidden="true">⌄</i>
      </summary>
      <ol className="trace-list">
        {response.trace.map((event) => (
          <li className={`trace-event trace-event--${event.action}`} key={event.id}>
            <span aria-hidden="true">
              {event.action === "policy_block"
                ? "◇"
                : event.action === "fallback"
                  ? "↯"
                  : event.action === "approval_request"
                    ? "?"
                    : "✓"}
            </span>
            <div>
              <strong>{event.title}</strong>
              <p>{event.description}</p>
              {event.metrics ? (
                <small>
                  {Object.entries(event.metrics)
                    .map(([key, value]) => `${key}: ${String(value)}`)
                    .join(" · ")}
                </small>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <div className="trace-panel__foot">
        <span>추천 실행 상세</span>
        <code>필터 · 검색 · 선택 · 정책 · Trace</code>
      </div>
    </details>
  );
}

function ApprovalView({
  response,
  onDecision,
  deciding,
  error,
}: {
  response: AwaitingApprovalRecommendationResponse;
  onDecision: (decision: ApprovalDecision) => void;
  deciding: ApprovalDecision | null;
  error: string;
}) {
  return (
    <>
      <section className="approval-banner">
        <div className="approval-banner__icon" aria-hidden="true">
          ?
        </div>
        <div className="approval-banner__copy">
          <p className="eyebrow">APPROVAL REQUIRED</p>
          <h1>{response.proposal.question}</h1>
          <p>
            넓어지는 조건은 러닝타임뿐이에요. 구독 OTT·기분·연령 기준은
            그대로 유지합니다.
          </p>
          <div className="approval-change">
            <span>
              현재 <strong>30분</strong>
            </span>
            <i aria-hidden="true">→</i>
            <span>
              제안 <strong>45분</strong>
            </span>
            <small>후보 {response.proposal.currentCandidateCount}편 → 5편 예상</small>
          </div>
          <div className="approval-actions">
            <button
              className="button button--primary"
              onClick={() => onDecision("approve")}
              disabled={deciding !== null}
            >
              {deciding === "approve"
                ? "45분까지 다시 찾는 중…"
                : response.proposal.approveLabel}
            </button>
            <button
              className="button button--ghost"
              onClick={() => onDecision("reject")}
              disabled={deciding !== null}
            >
              {deciding === "reject"
                ? "30분 결과를 정리하는 중…"
                : response.proposal.rejectLabel}
            </button>
          </div>
          {error ? (
            <p className="form-error approval-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      <section className="partial-results">
        <div className="result-section-heading">
          <div>
            <p className="eyebrow">CURRENT MATCHES</p>
            <h2>30분 조건에 맞는 {response.partialRecommendations.length}편</h2>
          </div>
          <span className="status-chip">조건 유지 중</span>
        </div>
        <div className="content-grid">
          {response.partialRecommendations.map((item, index) => (
            <ContentCard
              item={item}
              rank={index + 1}
              key={item.content.id}
            />
          ))}
        </div>
      </section>
      <Timeline response={response} />
    </>
  );
}

export function CompletedView({
  response,
  onReplace,
  replacingId,
  replacementFeedback,
}: {
  response: CompletedRecommendationResponse;
  onReplace: (contentId: string) => void;
  replacingId: string | null;
  replacementFeedback: ReplacementFeedback | null;
}) {
  const alternatives = response.recommendations.filter(
    (item) => item.content.id !== response.topPick?.content.id,
  );

  return (
    <>
      <header className="results-heading">
        <div>
          <p className="eyebrow">YOUR PICKS</p>
          <h1>
            오늘은 이 {response.recommendations.length}편이면 충분해요.
          </h1>
          <p>선택한 조건을 끝까지 지키고, 마지막 안전 검사까지 마쳤어요.</p>
        </div>
        <div className="results-heading__actions">
          <span className="status-chip status-chip--safe">
            <span aria-hidden="true">◇</span>
            정책 확인 완료
          </span>
          <Link href="/choice" className="button button--ghost">
            조건 바꾸기
          </Link>
        </div>
      </header>

      <ReplacementFeedbackNotice feedback={replacementFeedback} />

      {response.fallbackUsed ? (
        <aside className="result-notice result-notice--fallback">
          <span aria-hidden="true">↯</span>
          <div>
            <strong>빠른 규칙 추천으로 전환했어요.</strong>
            <p>
              추천 도구 사용 한도에 도달해도 같은 필터와 안전 기준은 그대로
              지켰습니다.
            </p>
          </div>
        </aside>
      ) : null}

      {response.policyBlockedCount > 0 ? (
        <aside className="result-notice result-notice--policy">
          <span aria-hidden="true">◇</span>
          <div>
            <strong>연령 기준에 맞지 않는 후보를 제외했어요.</strong>
            <p>
              부적합 후보 {response.policyBlockedCount}편의 제목과 상세는
              노출하지 않았습니다.
            </p>
          </div>
        </aside>
      ) : null}

      {response.notice ? (
        <aside className="result-notice result-notice--neutral">
          <span aria-hidden="true">i</span>
          <div>
            <strong>{response.notice}</strong>
          </div>
        </aside>
      ) : null}

      {response.topPick ? (
        <div className="results-hero-grid">
          <ContentCard
            item={response.topPick}
            rank={1}
            hero
            onReplace={onReplace}
            replacing={replacingId === response.topPick.content.id}
            replacementPending={replacingId !== null}
          />
          <Timeline response={response} />
        </div>
      ) : (
        <div className="empty-state">
          <span aria-hidden="true">◇</span>
          <h2>조건에 맞는 안전한 작품이 없어요.</h2>
          <p>조건을 자동으로 바꾸지 않았어요. CHOICE에서 다시 골라 주세요.</p>
          <Link href="/choice" className="button button--primary">
            조건 다시 고르기
          </Link>
        </div>
      )}

      {alternatives.length ? (
        <section className="alternative-section">
          <div className="result-section-heading">
            <div>
              <p className="eyebrow">ALSO FOR YOU</p>
              <h2>함께 비교해 볼 후보</h2>
            </div>
            <span>{alternatives.length}편</span>
          </div>
          <div className="content-grid content-grid--four">
            {alternatives.map((item, index) => (
              <ContentCard
                item={item}
                rank={index + 2}
                  key={item.content.id}
                onReplace={onReplace}
                replacing={replacingId === item.content.id}
                replacementPending={replacingId !== null}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

export function RecommendationView({ runId }: RecommendationViewProps) {
  const [response, setResponse] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [deciding, setDeciding] = useState<ApprovalDecision | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [replacementFeedback, setReplacementFeedback] =
    useState<ReplacementFeedback | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const replacementLock = useRef(false);

  const loadRun = useCallback(async () => {
    try {
      const request = await fetch(
        `/api/recommendations/${encodeURIComponent(runId)}`,
        { cache: "no-store" },
      );
      const result = (await request.json().catch(() => null)) as
        | RecommendationResponse
        | { error?: string }
        | null;
      if (!request.ok || !result || !("status" in result)) {
        throw new Error(
          (result && "error" in result && result.error) ||
            "추천 기록을 찾을 수 없어요.",
        );
      }
      setResponse(result);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "추천 기록을 찾을 수 없어요.",
      );
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    let ignore = false;
    const request = fetch(
      `/api/recommendations/${encodeURIComponent(runId)}`,
      { cache: "no-store" },
    );

    void request
      .then(async (resultResponse) => {
        const result = (await resultResponse.json().catch(() => null)) as
          | RecommendationResponse
          | { error?: string }
          | null;
        if (!resultResponse.ok || !result || !("status" in result)) {
          throw new Error(
            (result && "error" in result && result.error) ||
              "추천 기록을 찾을 수 없어요.",
          );
        }
        return result;
      })
      .then((result) => {
        if (!ignore) setResponse(result);
      })
      .catch((loadError: unknown) => {
        if (ignore) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "추천 기록을 찾을 수 없어요.",
        );
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [runId]);

  async function decide(decision: ApprovalDecision) {
    setDeciding(decision);
    setActionError("");
    try {
      const request = await fetch(
        `/api/recommendations/${encodeURIComponent(runId)}/approval`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      const result = (await request.json().catch(() => null)) as
        | RecommendationResponse
        | { error?: string }
        | null;
      if (!request.ok || !result || !("status" in result)) {
        throw new Error(
          (result && "error" in result && result.error) ||
            "승인 결과를 반영하지 못했어요.",
        );
      }
      setResponse(result);
      setAnnouncement(
        decision === "approve"
          ? "45분까지 넓혀 추천을 다시 만들었어요."
          : "30분 조건을 유지한 결과를 보여드려요.",
      );
    } catch (decisionError) {
      setActionError(
        decisionError instanceof Error
          ? decisionError.message
          : "승인 결과를 반영하지 못했어요.",
      );
    } finally {
      setDeciding(null);
    }
  }

  async function replace(contentId: string) {
    if (replacementLock.current) return;
    replacementLock.current = true;
    setReplacingId(contentId);
    setReplacementFeedback(REPLACEMENT_FEEDBACK.pending);
    setAnnouncement(
      `${REPLACEMENT_FEEDBACK.pending.title} ${REPLACEMENT_FEEDBACK.pending.description}`,
    );
    try {
      const storageKey = "ott-damoa:not-interested";
      const current = JSON.parse(
        sessionStorage.getItem(storageKey) ?? "[]",
      ) as unknown;
      const values = Array.isArray(current)
        ? current.filter((value): value is string => typeof value === "string")
        : [];
      sessionStorage.setItem(
        storageKey,
        JSON.stringify([...new Set([...values, contentId])]),
      );
    } catch {
      // Replacement remains available when browser storage is unavailable.
    }
    try {
      const request = await fetch(
        `/api/recommendations/${encodeURIComponent(runId)}/replacement`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contentId }),
        },
      );
      const result = (await request.json().catch(() => null)) as
        | RecommendationResponse
        | { error?: string }
        | null;
      if (!request.ok || !result || !("status" in result)) {
        throw new ReplacementRequestError(
          request.status === 400 ? "exhausted" : "error",
          (result && "error" in result && result.error) ||
            "다른 후보가 없어요.",
        );
      }
      if (result.status !== "completed") {
        throw new ReplacementRequestError(
          "error",
          "교체 결과를 확인하지 못했어요.",
        );
      }
      setResponse(result);
      setReplacementFeedback(REPLACEMENT_FEEDBACK.success);
      setAnnouncement(
        `${REPLACEMENT_FEEDBACK.success.title} ${REPLACEMENT_FEEDBACK.success.description}`,
      );
    } catch (replaceError) {
      const feedback =
        replaceError instanceof ReplacementRequestError
          ? {
              ...REPLACEMENT_FEEDBACK[replaceError.feedbackStatus],
              description: `${replaceError.message} 기존 결과는 그대로 유지했어요.`,
            }
          : REPLACEMENT_FEEDBACK.error;
      setReplacementFeedback(feedback);
      setAnnouncement(`${feedback.title} ${feedback.description}`);
    } finally {
      replacementLock.current = false;
      setReplacingId(null);
    }
  }

  if (loading) {
    return (
      <div className="result-loading" role="status">
        <span className="result-loading__mark" aria-hidden="true">
          D
        </span>
        <p className="eyebrow">RECOMMENDATION RUN</p>
        <h1>선택한 조건을 차례로 확인하고 있어요.</h1>
        <ol>
          <li className="is-active">필수 조건 확인</li>
          <li>후보 점수 계산</li>
          <li>마지막 정책 검사</li>
        </ol>
      </div>
    );
  }

  if (error || !response) {
    return (
      <div className="empty-state empty-state--error">
        <span aria-hidden="true">!</span>
        <h1>추천 기록을 불러오지 못했어요.</h1>
        <p>{error || "추천 기록이 만료되었거나 저장소에 없을 수 있어요."}</p>
        <div>
          <button
            className="button button--ghost"
            onClick={() => {
              setLoading(true);
              setError("");
              void loadRun();
            }}
          >
            다시 시도
          </button>
          <Link href="/choice" className="button button--primary">
            새 추천 받기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="results-page">
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
      {response.status === "awaiting_approval" ? (
        <ApprovalView
          response={response}
          onDecision={decide}
          deciding={deciding}
          error={actionError}
        />
      ) : (
        <CompletedView
          response={response}
          onReplace={replace}
          replacingId={replacingId}
          replacementFeedback={replacementFeedback}
        />
      )}
    </div>
  );
}
