import Link from "next/link";

export function LandingNav() {
  return (
    <header className="cinema-header absolute inset-x-0 top-0 z-30 border-b border-white/10 bg-[#10151b]/70 backdrop-blur-xl">
      <nav
        className="cinema-nav mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:h-[4.5rem] sm:gap-4 sm:px-6 lg:px-8"
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

        <Link
          href="/choice"
          className="ml-auto inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#ff6b3d] px-4 py-2 text-xs font-bold text-white shadow-[0_8px_30px_rgba(255,107,61,0.22)] transition hover:bg-[#ff7d56] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-5 sm:text-sm"
        >
          <span className="sm:hidden">추천 시작</span>
          <span className="hidden sm:inline">추천 시작하기</span>
        </Link>
      </nav>
    </header>
  );
}
