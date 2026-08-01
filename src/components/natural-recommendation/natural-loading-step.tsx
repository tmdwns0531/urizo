import type { CSSProperties } from "react";

export type NaturalLoadingStepName = "analyzing" | "matching";

type EmojiParticle = {
  emoji: string;
  left: string;
  animationDelay: string;
  fontSize: string;
  rotate: string;
  duration: string;
  drift: string;
};

const CINEMA_EMOJI_PARTICLES: readonly EmojiParticle[] = [
  { emoji: "🍿", left: "7%", animationDelay: "-0.8s", fontSize: "1.7rem", rotate: "-12deg", duration: "7.4s", drift: "2rem" },
  { emoji: "🎬", left: "18%", animationDelay: "-4.6s", fontSize: "2.1rem", rotate: "9deg", duration: "8.6s", drift: "-1.5rem" },
  { emoji: "🎥", left: "31%", animationDelay: "-2.9s", fontSize: "1.55rem", rotate: "-7deg", duration: "6.9s", drift: "1.2rem" },
  { emoji: "🎫", left: "68%", animationDelay: "-5.7s", fontSize: "1.8rem", rotate: "14deg", duration: "8.1s", drift: "-2.2rem" },
  { emoji: "🕶️", left: "79%", animationDelay: "-1.7s", fontSize: "2rem", rotate: "-10deg", duration: "7.7s", drift: "1.8rem" },
  { emoji: "🥤", left: "90%", animationDelay: "-6.4s", fontSize: "1.65rem", rotate: "8deg", duration: "9.2s", drift: "-1rem" },
  { emoji: "🤫", left: "55%", animationDelay: "-3.8s", fontSize: "1.45rem", rotate: "-4deg", duration: "7.1s", drift: "2.4rem" },
] as const;

type EmojiParticleStyle = CSSProperties & {
  "--emoji-rotate": string;
  "--emoji-duration": string;
  "--emoji-drift": string;
};

export function NaturalLoadingStep({ step }: { step: NaturalLoadingStepName }) {
  const isMatching = step === "matching";

  return (
    <main
      className="relative isolate mx-auto flex w-full max-w-[50rem] flex-1 items-center justify-center overflow-hidden px-5 py-16 text-center sm:px-6"
      aria-live="polite"
      aria-busy="true"
      data-natural-loading={step}
    >
      <div
        className="natural-loading-emoji-layer"
        aria-hidden="true"
      >
        {CINEMA_EMOJI_PARTICLES.map((particle) => (
          <span
            className="natural-loading-emoji"
            key={particle.emoji}
            style={
              {
                left: particle.left,
                animationDelay: particle.animationDelay,
                fontSize: particle.fontSize,
                "--emoji-rotate": particle.rotate,
                "--emoji-duration": particle.duration,
                "--emoji-drift": particle.drift,
              } as EmojiParticleStyle
            }
          >
            {particle.emoji}
          </span>
        ))}
      </div>

      <section className="relative z-10 w-full" aria-labelledby="natural-loading-title">
        <div className="relative mx-auto grid size-20 place-items-center">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-slate-700 border-t-orange-500 motion-reduce:animate-none" />
          <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#ff5430] to-[#ff7c42] text-2xl font-black text-white shadow-[0_14px_35px_rgba(255,89,45,.22)]">
            D
          </span>
        </div>
        <p className="choice-stepper__eyebrow mt-7">추천을 준비하고 있어요</p>
        <h1
          id="natural-loading-title"
          className="mt-2 text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl"
        >
          {isMatching ? "작품 매칭 중" : "조건 분석 중"}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400 sm:text-base">
          {isMatching
            ? "지킨 조건 안에서 후보를 비교하고 마지막 안전 기준을 확인해요."
            : "말씀해 주신 조건과 비어 있는 조건을 구분하고 있어요."}
        </p>

        <ol className="mx-auto mt-8 grid max-w-xl grid-cols-3 gap-2 text-xs font-bold sm:text-sm">
          <li className="rounded-xl border border-orange-500/35 bg-orange-500/10 px-2 py-3 text-orange-300">
            <span className="block text-[0.65rem] text-orange-500">01</span>
            조건 분석
          </li>
          <li
            className={`rounded-xl border px-2 py-3 ${
              isMatching
                ? "border-orange-500/35 bg-orange-500/10 text-orange-300"
                : "border-slate-800 bg-white/[0.03] text-slate-600"
            }`}
          >
            <span className="block text-[0.65rem]">02</span>
            작품 매칭
          </li>
          <li className="rounded-xl border border-slate-800 bg-white/[0.03] px-2 py-3 text-slate-600">
            <span className="block text-[0.65rem]">03</span>
            결과 정리
          </li>
        </ol>
      </section>
    </main>
  );
}
