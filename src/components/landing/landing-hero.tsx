import Link from "next/link";
import { HERO_POSTERS, SUPPORTED_PROVIDERS } from "./landing-data";

const HERO_POSTER_LAYOUT = [
  "left-1/2 top-1 z-20 w-[11.5rem] -translate-x-1/2",
  "left-2 top-16 z-10 w-[7.5rem] -rotate-1",
  "right-2 top-16 z-10 w-[7.5rem] rotate-1",
  "bottom-1 left-4 z-10 w-[7.25rem] rotate-[0.5deg]",
  "bottom-0 left-1/2 z-10 w-[7.25rem] -translate-x-1/2",
  "bottom-1 right-4 z-10 w-[7.25rem] -rotate-[0.5deg]",
] as const;

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

      <div className="app-container cinema-hero__grid grid grid-cols-1 items-center gap-12 pb-16 sm:pb-20 lg:grid-cols-[minmax(0,1.12fr)_minmax(23rem,.82fr)] lg:gap-12">
        <div className="cinema-hero__copy relative z-10 min-w-0 max-w-2xl text-center lg:text-left">
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

          <div className="mx-auto mt-8 flex max-w-2xl flex-col justify-center gap-3 sm:flex-row lg:mx-0 lg:justify-start">
            <Link
              href="/choice"
              data-cta="primary"
              className="group inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ff5430] to-[#ff7c42] px-7 py-3 text-sm font-extrabold text-white shadow-[0_12px_35px_rgba(255,107,61,0.28)] transition hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:text-base"
            >
              조건을 골라 추천받기
              <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
            </Link>
            <Link
              href="/prompt"
              data-cta="secondary"
              className="group inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-white/15 bg-[#17202a] px-7 py-3 text-sm font-extrabold text-slate-200 transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-[#1d2935] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff7043] sm:text-base"
            >
              문장으로 추천받기
              <span className="rounded-full bg-white/10 px-2 py-1 text-sm font-bold text-slate-300 transition-colors group-hover:text-white">Beta</span>
            </Link>
          </div>

          <div className="mx-auto mt-8 max-w-2xl border-t border-white/10 pt-6 text-center lg:mx-0 lg:text-left">
            <p className="text-base leading-7 text-slate-300">
              이용 중인 OTT를 선택하면, 그 안에서 볼 수 있는 작품만 추천해요.
            </p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-300">
              {SUPPORTED_PROVIDERS.join(" · ")}
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
              지금 상황 반영 · 추천 이유 제공
            </p>
          </div>
        </div>

        <div className="relative mx-auto hidden h-[32rem] w-full max-w-[28rem] lg:mx-0 lg:block">
          <div className="absolute inset-[12%_8%_8%] rounded-[3rem] bg-[#6090a8]/16 blur-3xl" aria-hidden="true" />
          <div className="absolute inset-0" aria-hidden="true">
            {HERO_POSTERS.map((poster, index) => (
              <div
                key={poster.id}
                data-poster-emphasis={index === 0 ? "main" : "supporting"}
                className={`absolute aspect-[2/3] overflow-hidden rounded-xl bg-cover bg-center bg-no-repeat shadow-[0_18px_40px_rgba(0,0,0,0.34)] ${HERO_POSTER_LAYOUT[index]}`}
                style={{
                  backgroundColor: "#17202a",
                  backgroundImage: `url(${poster.posterUrl})`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
