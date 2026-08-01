"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  active?: "choice" | "results";
  minimal?: boolean;
  confirmChoiceReset?: boolean;
};

export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={`brand-mark${inverse ? " brand-mark--inverse" : ""}`}>
      <span className="brand-mark__symbol" aria-hidden="true">
        D
      </span>
      <span className="brand-mark__text">
        <strong>OTT 다모아</strong>
        <small>DECIDE, THEN WATCH</small>
      </span>
    </span>
  );
}

export function AppShell({
  children,
  active,
  minimal = false,
  confirmChoiceReset = false,
}: AppShellProps) {
  return (
    <div className="app-frame">
      <header className="site-header">
        <div className="site-header__inner">
          <Link href="/" className="brand-link" aria-label="OTT 다모아 홈">
            <BrandMark />
          </Link>

          {!minimal ? (
            <>
              <nav className="desktop-nav" aria-label="주요 메뉴">
                <Link
                  href="/choice"
                  className={active === "choice" ? "is-active" : undefined}
                >
                  CHOICE
                </Link>
              </nav>
              <div className="header-actions">
                <span className="demo-pill">
                  <span className="demo-pill__dot" />
                  익명 추천
                </span>
                <Link
                  href="/choice"
                  className="text-link"
                  onNavigate={(event) => {
                    const hasDraft = document.querySelector(
                      '[data-choice-dirty="true"]',
                    );
                    if (
                      confirmChoiceReset &&
                      hasDraft &&
                      !window.confirm(
                        "입력한 조건이 초기화됩니다. 새 추천을 시작할까요?",
                      )
                    ) {
                      event.preventDefault();
                      return;
                    }
                    event.preventDefault();
                    window.location.assign("/choice");
                  }}
                >
                  새 추천 받기
                </Link>
              </div>
            </>
          ) : (
            <Link href="/choice" className="text-link">
              바로 추천받기
            </Link>
          )}
        </div>
      </header>

      <main>{children}</main>

      {!minimal ? (
        <nav className="mobile-nav" aria-label="모바일 주요 메뉴">
          {active === "choice" ? (
            <button
              type="submit"
              form="choice-form"
              className="is-active"
            >
              <span aria-hidden="true">✦</span>
              5편 추천받기
            </button>
          ) : (
            <Link href="/choice">
              <span aria-hidden="true">✦</span>
              새 추천 받기
            </Link>
          )}
        </nav>
      ) : null}
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="page-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}
