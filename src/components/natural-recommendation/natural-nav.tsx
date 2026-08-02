"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

export function NaturalRecommendationNav({
  dirty,
  onReset,
}: {
  dirty: boolean;
  onReset: () => void;
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
        <button
          type="button"
          className="choice-stepper-nav__reset"
          onClick={onReset}
        >
          처음부터
        </button>
      </nav>
    </header>
  );
}
