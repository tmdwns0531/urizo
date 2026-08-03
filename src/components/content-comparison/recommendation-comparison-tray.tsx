"use client";

import Link from "next/link";
import { useCallback, useState, type ReactNode } from "react";
import type { CatalogContent } from "@/contracts/catalog";

type ComparableContent = Pick<CatalogContent, "id" | "title">;

type ComparisonCandidateProps = {
  children: ReactNode;
  content: ComparableContent;
  disabled: boolean;
  rail?: boolean;
  selected: boolean;
  onToggle: (contentId: string) => void;
};

export function useRecommendationComparisonSelection(
  contents: ComparableContent[],
) {
  const [storedSelectedIds, setSelectedIds] = useState<string[]>([]);
  const availableIds = new Set(contents.map(({ id }) => id));
  const selectedIds = storedSelectedIds
    .filter((id) => availableIds.has(id))
    .slice(0, 2);

  const toggle = useCallback((contentId: string) => {
    setSelectedIds((current) => {
      const currentAvailable = current
        .filter((id) => contents.some((content) => content.id === id))
        .slice(0, 2);
      if (currentAvailable.includes(contentId)) {
        return currentAvailable.filter((id) => id !== contentId);
      }
      if (
        currentAvailable.length >= 2 ||
        !contents.some((content) => content.id === contentId)
      ) {
        return currentAvailable;
      }
      return [...currentAvailable, contentId];
    });
  }, [contents]);

  return { selectedIds, toggle };
}

export function ComparisonCandidate({
  children,
  content,
  disabled,
  rail = false,
  selected,
  onToggle,
}: ComparisonCandidateProps) {
  const label = selected
    ? "비교 선택됨"
    : disabled
      ? "비교는 두 편까지"
      : "비교하기";

  return (
    <div
      className={`relative min-w-0 ${
        rail
          ? "w-[min(76vw,17rem)] shrink-0 snap-center md:w-auto"
          : "w-full"
      }`}
      data-comparison-candidate={content.id}
    >
      {children}
      <button
        type="button"
        className={`absolute right-4 top-4 z-20 inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-black shadow-[0_10px_28px_rgba(0,0,0,.35)] backdrop-blur-md transition focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-orange-300 disabled:cursor-not-allowed disabled:opacity-55 ${
          selected
            ? "border-orange-300/60 bg-orange-500/90 text-white"
            : "border-white/20 bg-[#10151b]/90 text-slate-100 hover:border-orange-300/55 hover:text-orange-100"
        }`}
        aria-pressed={selected}
        aria-label={`${content.title} ${label}`}
        disabled={disabled}
        onClick={() => onToggle(content.id)}
      >
        <span aria-hidden="true">{selected ? "✓" : "+"}</span>
        {label}
      </button>
    </div>
  );
}

export function RecommendationComparisonTray({
  contents,
  selectedIds,
  onToggle,
}: {
  contents: ComparableContent[];
  selectedIds: string[];
  onToggle: (contentId: string) => void;
}) {
  const selectedContents = selectedIds
    .map((id) => contents.find((content) => content.id === id))
    .filter((content): content is ComparableContent => content !== undefined);

  if (selectedContents.length === 0) return null;

  const compareHref =
    selectedContents.length === 2
      ? `/compare?left=${encodeURIComponent(selectedContents[0].id)}&right=${encodeURIComponent(selectedContents[1].id)}`
      : null;

  return (
    <aside
      className="fixed left-3 right-3 z-50 rounded-2xl border border-white/15 bg-[#111820]/95 p-3 shadow-[0_22px_65px_rgba(0,0,0,.5)] backdrop-blur-xl sm:left-auto sm:right-6 sm:w-[24rem]"
      style={{ bottom: "calc(104px + env(safe-area-inset-bottom))" }}
      aria-label="작품 비교 선택"
      data-comparison-tray="true"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">작품 비교</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-400">
            두 편을 고르면 상세 비교로 이동해요.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-sm font-black text-orange-200">
          {selectedContents.length}/2
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {selectedContents.map((content, index) => (
          <button
            type="button"
            className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-left text-sm font-bold text-slate-100 transition hover:border-orange-300/40 hover:bg-orange-400/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-300"
            onClick={() => onToggle(content.id)}
            aria-label={`${content.title} 비교에서 빼기`}
            key={content.id}
          >
            <span className="truncate">
              {index === 0 ? "A" : "B"}. {content.title}
            </span>
            <span aria-hidden="true" className="text-slate-400">×</span>
          </button>
        ))}
        {selectedContents.length === 1 ? (
          <span className="flex min-h-11 items-center rounded-xl border border-dashed border-white/15 px-3 text-sm font-semibold text-slate-500">
            B. 한 편 더 선택
          </span>
        ) : null}
      </div>

      {compareHref ? (
        <Link
          href={compareHref}
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#ff5430] to-[#ff7c42] px-4 text-sm font-black text-white shadow-[0_10px_28px_rgba(255,89,45,.22)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white"
        >
          두 작품 비교하기
        </Link>
      ) : (
        <span className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-bold text-slate-400">
          비교할 작품을 한 편 더 골라주세요
        </span>
      )}
    </aside>
  );
}
