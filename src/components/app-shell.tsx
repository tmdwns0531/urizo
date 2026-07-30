"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  active?: "choice" | "my";
  minimal?: boolean;
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
}: AppShellProps) {
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/users/profile", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { displayName?: string };
      })
      .then((profile) => {
        if (!cancelled && profile?.displayName) {
          setDisplayName(profile.displayName);
        }
      })
      .catch(() => {
        // The shell remains usable with the Demo fallback label.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const profileLabel = displayName || "Demo";
  const profileInitial = profileLabel.trim().slice(0, 1).toUpperCase() || "D";

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
                <Link
                  href="/my"
                  className={active === "my" ? "is-active" : undefined}
                >
                  MY
                </Link>
              </nav>
              <div className="header-actions">
                <span className="demo-pill">
                  <span className="demo-pill__dot" />
                  로컬 Demo
                </span>
                <Link href="/my" className="profile-chip" aria-label="MY 프로필">
                  <span aria-hidden="true">{profileInitial}</span>
                  <strong>{profileLabel}</strong>
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
          <Link
            href="/choice"
            className={active === "choice" ? "is-active" : undefined}
          >
            <span aria-hidden="true">✦</span>
            추천받기
          </Link>
          <Link
            href="/my"
            className={active === "my" ? "is-active" : undefined}
          >
            <span aria-hidden="true">●</span>
            MY
          </Link>
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
