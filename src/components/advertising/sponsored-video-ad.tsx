"use client";

import { useEffect, useState } from "react";
import type {
  AdMeasurementEvent,
  AdPlacement,
  AdSelectionResponse,
  AnonymousAdContext,
  SponsoredCampaignCreative,
} from "@/contracts/advertising";
import type { MvpRecommendationChoice } from "@/contracts/mvp-search";

type SponsoredVideoAdProps = {
  placement: AdPlacement;
  theme: "light" | "dark";
  runId?: string;
  context?: AnonymousAdContext;
  variant?: "default" | "rail";
};

export function toAnonymousAdContext(
  choice: MvpRecommendationChoice | undefined,
): AnonymousAdContext {
  return {
    selectedProviders: choice?.selectedProviders ?? [],
    companions: choice?.companions ?? [],
    moods: choice?.moods ?? [],
    desiredGenres: choice?.desiredGenres ?? [],
  };
}

function sendMeasurement(
  campaignId: string,
  placement: AdPlacement,
  event: AdMeasurementEvent,
) {
  void fetch("/api/ads/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ campaignId, placement, event }),
    keepalive: true,
  }).catch(() => undefined);
}

export function SponsoredVideoAd({
  placement,
  theme,
  runId,
  context,
  variant = "default",
}: SponsoredVideoAdProps) {
  const contextKey = JSON.stringify(context ?? null);
  const requestKey = `${placement}:${runId ?? ""}:${contextKey}`;
  const [selection, setSelection] = useState<{
    requestKey: string;
    campaign: SponsoredCampaignCreative | null;
    loaded: boolean;
  }>({ requestKey, campaign: null, loaded: false });
  const loading = selection.requestKey !== requestKey || !selection.loaded;
  const campaign =
    selection.requestKey === requestKey ? selection.campaign : null;

  useEffect(() => {
    const controller = new AbortController();
    const requestContext = JSON.parse(contextKey) as
      | AnonymousAdContext
      | null;

    void fetch("/api/ads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        placement,
        runId,
        context: requestContext ?? undefined,
      }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = (await response.json().catch(() => null)) as
          | AdSelectionResponse
          | null;
        if (!response.ok || !result) throw new Error("ad selection failed");
        return result.campaign;
      })
      .then((selected) => {
        if (controller.signal.aborted) return;
        setSelection({ requestKey, campaign: selected, loaded: true });
        if (selected) {
          sendMeasurement(selected.id, placement, "IMPRESSION");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSelection({ requestKey, campaign: null, loaded: true });
        }
      });

    return () => controller.abort();
  }, [contextKey, placement, requestKey, runId]);

  if (loading) {
    return (
      <aside
        className={`sponsored-ad sponsored-ad--${theme} sponsored-ad--loading${
          variant === "rail" ? " sponsored-ad--rail" : ""
        }`}
        aria-label="광고 불러오는 중"
      >
        <div className="sponsored-ad__media-placeholder">
          <span className="ad-label">광고</span>
        </div>
        <div className="sponsored-ad__loading-copy">
          <span />
          <span />
        </div>
      </aside>
    );
  }

  if (!campaign) {
    if (variant !== "rail") return null;
    return (
      <aside className="flex h-full min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#17202a] shadow-[0_16px_45px_rgba(0,0,0,.18)]" aria-label="추천 서비스 안내">
        <div className="relative grid aspect-[4/5] place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_25%,rgba(83,169,255,.18),transparent_35%),linear-gradient(145deg,#111923,#0f1215)] p-6 text-center">
          <span className="absolute left-4 top-4 rounded-md border border-white/15 bg-black/50 px-2.5 py-1.5 text-sm font-black text-slate-100">
            안내
          </span>
          <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-[#ff5430] to-[#ff7c42] text-2xl font-black text-white shadow-[0_16px_40px_rgba(255,89,45,.22)]" aria-hidden="true">
            D
          </span>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <p className="text-sm font-black tracking-[0.12em] text-orange-300">
            OTT 다모아 안내
          </p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-white">
            다른 조건으로도 빠르게 비교해 보세요.
          </h2>
          <p className="mt-3 text-base leading-7 text-slate-300">
            추천 결과와 안내 콘텐츠는 구분해서 제공되며 작품 순위에 영향을 주지 않아요.
          </p>
          <a
            href="/choice"
            className="mt-auto inline-flex min-h-12 items-center justify-center rounded-full border border-orange-400/30 bg-orange-500/10 px-5 text-sm font-black text-orange-100 transition hover:bg-orange-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-400"
          >
            새 조건 고르기
          </a>
        </div>
      </aside>
    );
  }

  const disclaimer =
    placement === "RESULT"
      ? "추천 결과와 광고는 별도로 제공됩니다"
      : "광고는 추천 결과에 영향을 주지 않아요";

  return (
    <aside
      className={`sponsored-ad sponsored-ad--${theme} sponsored-ad--${placement.toLowerCase()}${
        variant === "rail" ? " sponsored-ad--rail" : ""
      }`}
      aria-label={`${campaign.workTitle} 광고`}
      data-ad-placement={placement.toLowerCase()}
    >
      <div className="sponsored-ad__media">
        {/* A plain image is intentional: demo sponsored creatives are static. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={campaign.posterUrl}
          alt={`${campaign.workTitle} 스폰서 콘텐츠 포스터`}
        />
        <span className="ad-label">광고</span>
        <span className="sponsored-ad__sponsor-badge">스폰서 콘텐츠</span>
      </div>

      <div className="sponsored-ad__body">
        <p className="sponsored-ad__eyebrow">OTT 다모아 파트너</p>
        <h2>{campaign.workTitle}</h2>
        <p className="sponsored-ad__campaign-title">
          {campaign.campaignTitle}
        </p>
        <p className="sponsored-ad__disclaimer">
          <span aria-hidden="true">i</span>
          {disclaimer}
        </p>
        <a
          className="sponsored-ad__cta"
          href={campaign.detailUrl}
          target="_blank"
          rel="noreferrer sponsored"
          onClick={() => sendMeasurement(campaign.id, placement, "CLICK")}
        >
          자세히 보기 <span aria-hidden="true">↗</span>
        </a>
      </div>
    </aside>
  );
}
