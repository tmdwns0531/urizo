"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
  active?: "choice" | "results";
  minimal?: boolean;
  confirmChoiceReset?: boolean;
  header?: ReactNode;
  contentAsMain?: boolean;
  className?: string;
  naturalFlowStep?: string;
};

export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className="group inline-flex min-h-11 items-center gap-2">
      <span className="grid grid-cols-2 gap-0.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff7043] transition-transform group-hover:-translate-y-0.5" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#25c8a7] transition-transform group-hover:-translate-y-0.5" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#53a9ff] transition-transform group-hover:translate-y-0.5" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#b983ff] transition-transform group-hover:translate-y-0.5" />
      </span>
      <span
        className={`whitespace-nowrap text-base font-extrabold tracking-[-0.03em] sm:text-lg ${
          inverse ? "text-white" : "text-slate-100"
        }`}
      >
        OTT 다모아
      </span>
    </span>
  );
}

export function AppShell({
  children,
  active,
  minimal = false,
  confirmChoiceReset = false,
  header,
  contentAsMain = true,
  className = "",
  naturalFlowStep,
}: AppShellProps) {
  const content = contentAsMain ? (
    <main className="flex-1">{children}</main>
  ) : (
    children
  );

  return (
    <div
      className={`flex min-h-dvh flex-col overflow-x-clip bg-[#0f1215] text-[#f4f7f9] selection:bg-[#ff6b3d] selection:text-white ${className}`}
      data-app-shell="true"
      data-natural-flow-step={naturalFlowStep}
    >
      {header ?? (
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#10151b]/85 backdrop-blur-xl">
          <nav
            className="app-container flex h-16 items-center gap-3 sm:h-[4.5rem]"
            aria-label="추천 결과 메뉴"
          >
            <Link
              href="/"
              className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff7043]"
              aria-label="OTT 다모아 홈"
            >
              <BrandMark inverse />
            </Link>

            {!minimal ? (
              <>
                <Link
                  href="/choice"
                  className="absolute right-4 top-1/2 inline-flex min-h-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#ff6b3d] px-4 text-sm font-extrabold text-white shadow-[0_8px_30px_rgba(255,107,61,0.22)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:hidden"
                >
                  새 추천
                </Link>
                <div className="ml-auto hidden items-center gap-3 sm:flex">
                  {active === "results" ? (
                    <span className="text-sm font-bold text-slate-400">
                      추천 결과
                    </span>
                  ) : null}
                  <Link
                    href="/choice"
                    className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#ff6b3d] px-5 py-2 text-sm font-extrabold text-white shadow-[0_8px_30px_rgba(255,107,61,0.22)] transition hover:-translate-y-0.5 hover:bg-[#ff7d56] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
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
              <Link
                href="/choice"
                className="ml-auto text-sm font-extrabold text-orange-300 transition hover:text-orange-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
              >
                바로 추천받기
              </Link>
            )}
          </nav>
        </header>
      )}

      {content}
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
