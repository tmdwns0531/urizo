import Link from "next/link";
import { HERO_POSTERS } from "./landing-data";

export function LandingHero() {
  return (
    <section
      className="cinema-hero relative isolate flex min-h-[47rem] items-center overflow-hidden border-b border-white/10 pt-24 sm:min-h-[50rem] sm:pt-28 lg:min-h-[51rem]"
      aria-labelledby="landing-title"
    >
      <div
        className="absolute inset-0 -z-30 bg-[radial-gradient(circle_at_75%_16%,rgba(75,112,137,0.35),transparent_38%),radial-gradient(circle_at_15%_70%,rgba(255,107,61,0.12),transparent_35%),linear-gradient(180deg,#121a22_0%,#10151b_76%)]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 -z-20 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        aria-hidden="true"
      />

      <div className="cinema-hero__grid mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-4 pb-16 sm:px-6 sm:pb-20 lg:grid-cols-[minmax(0,1.02fr)_minmax(26rem,.98fr)] lg:gap-10 lg:px-8">
        <div className="cinema-hero__copy relative z-10 min-w-0 max-w-2xl text-center lg:text-left">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#ff8762]/25 bg-[#ff7043]/10 px-3 py-1.5 text-xs font-bold tracking-[0.12em] text-[#ff9a7b] sm:text-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff7043] shadow-[0_0_12px_#ff7043]" />
            고르는 시간은 짧게, 보는 시간은 길게
          </p>
          <h1
            id="landing-title"
            className="break-words text-balance text-[clamp(2.25rem,7.6vw,5.5rem)] font-black leading-[1.02] tracking-[-0.055em] text-white"
          >
            오늘 볼 작품,
            <span className="mt-1 block bg-gradient-to-r from-[#ff8d6a] via-[#ff6846] to-[#e94e75] bg-clip-text text-transparent sm:mt-2">
              고민 대신 결정해요.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-7 text-slate-300 sm:text-lg sm:leading-8 lg:mx-0">
            누구와 볼지, 가능한 시간과 이용할 OTT를 고르면 지금 보기 좋은
            작품을 이유와 함께 추천해드려요.
          </p>

          <div className="mx-auto mt-8 grid max-w-2xl gap-3 rounded-[1.4rem] border border-white/15 bg-[#18212b]/90 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-md sm:grid-cols-2 sm:rounded-full lg:mx-0">
            <Link
              href="/choice"
              data-cta="primary"
              className="group flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#ff6b3d] px-5 py-3 text-sm font-extrabold text-white shadow-[0_12px_35px_rgba(255,107,61,0.28)] transition hover:-translate-y-0.5 hover:bg-[#ff7b53] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-base"
            >
              조건 골라 추천받기
              <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
            </Link>
            <Link
              href="/prompt"
              data-cta="secondary"
              className="group flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-extrabold text-slate-300 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-base"
            >
              한마디로 추천받기
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.62rem] font-bold text-slate-400 transition-colors group-hover:text-slate-200">Beta</span>
            </Link>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500 sm:ml-5 sm:text-sm lg:ml-4">
            두 방식 모두 계정 없이 바로 시작할 수 있어요.
          </p>

          <ul className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-medium text-slate-400 sm:text-sm lg:justify-start">
            <li className="flex items-center gap-1.5"><span className="text-[#34d3ae]" aria-hidden="true">✓</span>지금 상황부터</li>
            <li className="flex items-center gap-1.5"><span className="text-[#34d3ae]" aria-hidden="true">✓</span>OTT 조건 반영</li>
            <li className="flex items-center gap-1.5"><span className="text-[#34d3ae]" aria-hidden="true">✓</span>추천 이유 공개</li>
          </ul>
        </div>

        <div className="relative mx-auto hidden h-[39rem] w-full max-w-[34rem] lg:mx-0 lg:block lg:max-w-none">
          <div className="absolute inset-[10%_3%_6%_7%] rounded-[3rem] bg-[#6090a8]/20 blur-3xl" aria-hidden="true" />
          <div className="absolute inset-0 grid rotate-[-2deg] grid-cols-3 gap-3 px-3 py-5 sm:gap-4 lg:gap-5" aria-hidden="true">
            {HERO_POSTERS.map((poster, index) => (
              <div
                key={poster.id}
                className={`relative overflow-hidden rounded-xl border border-white/15 bg-cover bg-center shadow-[0_24px_50px_rgba(0,0,0,0.38)] ${
                  index === 1 || index === 4 ? "translate-y-9" : ""
                }`}
                style={{
                  backgroundColor: poster.backdropColor,
                  backgroundImage: `linear-gradient(to top, rgba(9,13,18,.58), transparent 45%), url(${poster.posterUrl})`,
                }}
              />
            ))}
          </div>
          <div className="absolute bottom-3 left-1/2 w-[88%] -translate-x-1/2 rounded-2xl border border-white/15 bg-[#111820]/88 p-4 shadow-2xl backdrop-blur-xl sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.65rem] font-bold tracking-[0.14em] text-[#ff8e6c]">추천 준비 완료</p>
              <p className="mt-1 text-sm font-bold text-white sm:text-base">조건에 맞는 후보를 비교할 준비가 됐어요</p>
            </div>
            <span className="mt-3 inline-flex rounded-full border border-[#34d3ae]/25 bg-[#34d3ae]/10 px-3 py-1.5 text-xs font-bold text-[#65e0c3] sm:mt-0">조건 확인</span>
          </div>
        </div>
      </div>
    </section>
  );
}
