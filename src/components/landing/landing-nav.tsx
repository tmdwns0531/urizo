import Link from "next/link";

export function LandingNav() {
  return (
    <header className="cinema-header absolute inset-x-0 top-0 z-30 border-b border-white/10 bg-[#10151b]/70 backdrop-blur-xl">
      <nav
        className="app-container cinema-nav flex h-16 items-center gap-2 sm:h-[4.5rem] sm:gap-4"
        aria-label="주요 메뉴"
      >
        <Link
          href="/"
          className="group flex min-h-11 shrink-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff7043]"
          aria-label="OTT 다모아 홈"
        >
          <span className="grid grid-cols-2 gap-0.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff7043] transition-transform group-hover:-translate-y-0.5" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#25c8a7] transition-transform group-hover:-translate-y-0.5" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#53a9ff] transition-transform group-hover:translate-y-0.5" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#b983ff] transition-transform group-hover:translate-y-0.5" />
          </span>
          <span className="whitespace-nowrap text-base font-extrabold tracking-[-0.03em] text-white sm:text-lg">
            OTT 다모아
          </span>
        </Link>

        <div className="ml-3 hidden items-center gap-5 text-sm font-medium text-slate-300 lg:flex xl:gap-7">
          <a href="#how-it-works" className="flex min-h-11 items-center rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff7043]">
            작동 방식
          </a>
          <a href="#recommendation-preview" className="flex min-h-11 items-center rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff7043]">
            추천 미리보기
          </a>
          <a href="#service-principles" className="flex min-h-11 items-center rounded-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff7043]">
            서비스 원칙
          </a>
        </div>

        <div
          className="ml-auto flex shrink-0 items-center text-sm font-extrabold text-slate-200"
          aria-label="계정 기능 준비 중"
        >
          <button
            type="button"
            disabled
            aria-label="회원가입 기능 준비 중"
            title="회원가입 기능 준비 중"
            className="inline-flex min-h-11 items-center px-2 transition-colors disabled:cursor-not-allowed disabled:opacity-100 sm:px-3"
          >
            회원가입
          </button>
          <span className="h-5 w-px bg-white/25" aria-hidden="true" />
          <button
            type="button"
            disabled
            aria-label="로그인 기능 준비 중"
            title="로그인 기능 준비 중"
            className="inline-flex min-h-11 items-center px-2 transition-colors disabled:cursor-not-allowed disabled:opacity-100 sm:px-3"
          >
            로그인
          </button>
        </div>
      </nav>
    </header>
  );
}
