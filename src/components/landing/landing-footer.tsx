import Link from "next/link";

export function LandingFooter() {
  return (
    <footer id="service-principles" className="cinema-footer scroll-mt-20 bg-[#090d12]">
      <div className="app-container py-16 sm:py-20">
        <div className="flex flex-col gap-9 border-b border-white/10 pb-12 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-bold tracking-[0.14em] text-[#ff9f82]">오늘의 선택을 더 가볍게</p>
            <h2 className="mt-3 text-balance text-3xl font-black leading-tight tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
              탐색을 멈추고,
              <br /> 이제 재생할 작품을 골라보세요.
            </h2>
          </div>
          <Link href="/choice" className="group inline-flex w-fit items-center gap-3 rounded-full bg-[#ff6b3d] px-6 py-3.5 text-sm font-extrabold text-white shadow-[0_14px_38px_rgba(255,107,61,.2)] transition hover:-translate-y-0.5 hover:bg-[#ff7c54] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:text-base">
            조건을 골라 추천받기
            <span className="text-lg transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="grid gap-10 py-10 sm:grid-cols-[1fr_auto] sm:items-start">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff7043]" aria-label="OTT 다모아 홈">
              <span className="flex gap-1" aria-hidden="true">
                <span className="h-3 w-3 rounded-full bg-[#ff7043]" />
                <span className="h-3 w-3 rounded-full bg-[#25c8a7]" />
                <span className="h-3 w-3 rounded-full bg-[#53a9ff]" />
              </span>
              <span className="text-lg font-extrabold tracking-[-0.03em] text-white">OTT 다모아</span>
            </Link>
            <p className="mt-4 max-w-md text-base leading-7 text-slate-300">
              오늘 볼 작품을 고르는 데 필요한 조건과 추천 이유를 한곳에서
              확인할 수 있어요.
            </p>
          </div>
          <ul className="grid gap-2 text-sm leading-6 text-slate-400 sm:text-right" aria-label="서비스 원칙">
            <li>원하는 조건을 직접 선택</li>
            <li>조건 변경 전 사용자 확인</li>
            <li>추천 이유와 확인 과정 공개</li>
          </ul>
        </div>
        <div className="flex flex-col gap-2 border-t border-white/10 pt-6 text-xs leading-5 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 OTT 다모아</p>
          <p>작품 정보와 제공처는 실제 시청 전 다시 확인해 주세요.</p>
        </div>
      </div>
    </footer>
  );
}
