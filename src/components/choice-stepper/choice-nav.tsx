"use client";

import Link from "next/link";
import type { MouseEvent } from "react";

type ChoiceNavProps = {
  dirty: boolean;
};

export function ChoiceNav({ dirty }: ChoiceNavProps) {
  function confirmReset(event: MouseEvent<HTMLAnchorElement>) {
    if (
      dirty &&
      !window.confirm("입력한 조건이 초기화됩니다. 이동할까요?")
    ) {
      event.preventDefault();
    }
  }

  function restartChoice(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (
      dirty &&
      !window.confirm("입력한 조건이 초기화됩니다. 처음부터 다시 할까요?")
    ) {
      return;
    }
    window.location.assign("/choice");
  }

  return (
    <header className="choice-stepper-nav">
      <nav className="app-container choice-stepper-nav__inner" aria-label="조건 선택 메뉴">
        <Link
          href="/"
          className="choice-stepper-brand"
          aria-label="OTT 다모아 홈"
          onClick={confirmReset}
        >
          <span aria-hidden="true">D</span>
          <strong>OTT 다모아</strong>
        </Link>
        <Link
          href="/choice"
          className="choice-stepper-nav__reset"
          onClick={restartChoice}
        >
          처음부터
        </Link>
      </nav>
    </header>
  );
}
