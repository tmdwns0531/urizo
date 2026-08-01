import Link from "next/link";
import { PREVIEW_POSTERS } from "./landing-data";

export function RecommendationShowcase() {
  return (
    <section
      id="recommendation-preview"
      className="cinema-showcase relative scroll-mt-20 overflow-hidden border-b border-white/10 bg-[#121820] px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      aria-labelledby="showcase-title"
    >
      <div className="absolute -right-40 top-20 h-96 w-96 rounded-full bg-[#324e68]/25 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold tracking-[0.18em] text-[#ff8c6a] sm:text-sm">추천 화면 미리보기</p>
            <h2 id="showcase-title" className="mt-3 text-balance text-3xl font-black leading-tight tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
              많이 보여주기보다,
              <br className="hidden sm:block" /> 고를 수 있게 비교해요.
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              작품 수를 늘리는 대신 지금 상황에 맞는 후보를 추리고, 서로
              다른 매력을 빠르게 파악할 수 있도록 정리합니다.
            </p>
          </div>
          <Link href="/choice" className="group inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:border-[#ff7043]/50 hover:bg-[#ff7043]/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff7043]">
            내 조건으로 추천 받기
            <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="mt-12 grid overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0e141b] shadow-[0_30px_90px_rgba(0,0,0,.28)] sm:mt-16 lg:grid-cols-[.75fr_1.25fr]">
          <div className="border-b border-white/10 p-6 sm:p-9 lg:border-r lg:border-b-0 lg:p-10">
            <div className="flex items-center justify-between gap-4">
              <span className="rounded-full border border-[#ff7043]/25 bg-[#ff7043]/10 px-3 py-1.5 text-xs font-bold text-[#ff9677]">예시 화면</span>
              <span className="text-xs text-slate-600">조건 확인 완료</span>
            </div>
            <p className="mt-8 text-xs font-bold tracking-[0.14em] text-slate-500">오늘의 상황</p>
            <h3 className="mt-3 text-2xl font-extrabold leading-snug tracking-[-0.03em] text-white sm:text-3xl">
              혼자서 편안하게,
              <br /> 두 시간 안에 보고 싶어요.
            </h3>
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="적용 조건 예시">
              {["혼자", "편안한", "2시간 안에", "이용 OTT만"].map((condition) => (
                <li key={condition} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300">
                  {condition}
                </li>
              ))}
            </ul>
            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="flex gap-2 text-sm leading-6 text-slate-400">
                <span className="mt-0.5 text-[#34d3ae]" aria-hidden="true">✓</span>
                필수 조건을 먼저 확인하고, 각 작품이 맞는 이유를 함께 설명해요.
              </p>
            </div>
          </div>

          <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto p-4 [scrollbar-width:thin] sm:grid sm:grid-cols-3 sm:overflow-visible sm:snap-none sm:p-6 lg:p-8">
            {PREVIEW_POSTERS.map((poster, index) => (
              <article key={poster.id} className="w-[min(78vw,17rem)] shrink-0 snap-center rounded-xl border border-white/10 bg-[#17202a] p-2.5 sm:w-auto">
                <div
                  className="aspect-[2/3] rounded-lg bg-cover bg-center"
                  style={{
                    backgroundColor: poster.backdropColor,
                    backgroundImage: `linear-gradient(to top, rgba(7,10,14,.35), transparent 35%), url(${poster.posterUrl})`,
                  }}
                  role="img"
                  aria-label={`${poster.title} 포스터`}
                />
                <div className="px-1 pb-1 pt-3">
                  <p className="text-[0.65rem] font-bold tracking-[0.12em] text-[#ff8d6c]">추천 {index + 1}</p>
                  <h4 className="mt-1 truncate text-sm font-extrabold text-white sm:text-base">{poster.title}</h4>
                  <p className="mt-1 text-xs text-slate-500">{poster.year} · {poster.detail}</p>
                  <p className="mt-2 truncate text-xs font-medium text-slate-400">{poster.provider}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
