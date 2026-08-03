"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { WatchlistNavLink } from "../watchlist/watchlist-nav-link";

/**
 * This flow replaces the AppShell header, so anything the default header
 * carries has to be repeated here.
 *
 * `onResult` mirrors the button-driven path: its input screen uses its own nav
 * without the watchlist, and only the result page renders the default header
 * with `active="results"`. Saving is meaningless before there are cards to
 * save, so the link appears with them.
 */
export function NaturalRecommendationNav({
  dirty,
  onReset,
  onResult = false,
}: {
  dirty: boolean;
  onReset: () => void;
  onResult?: boolean;
}) {
  function confirmLeave(event: MouseEvent<HTMLAnchorElement>) {
    if (dirty && !window.confirm("입력한 한마디가 초기화됩니다. 이동할까요?")) {
      event.preventDefault();
    }
  }

  return (
    <header className="choice-stepper-nav">
      <nav className="app-container choice-stepper-nav__inner" aria-label="한마디 추천 메뉴">
        <Link
          href="/"
          className="choice-stepper-brand"
          aria-label="OTT 다모아 홈"
          onClick={confirmLeave}
        >
          <span aria-hidden="true">D</span>
          <strong>OTT 다모아</strong>
        </Link>
        <div className="flex items-center gap-3">
          {onResult ? (
            <>
              <span className="hidden text-sm font-bold text-slate-400 sm:inline">
                추천 결과
              </span>
              <WatchlistNavLink />
            </>
          ) : null}
          <button
            type="button"
            className="choice-stepper-nav__reset"
            onClick={onReset}
          >
            처음부터
          </button>
        </div>
      </nav>
    </header>
  );
}
