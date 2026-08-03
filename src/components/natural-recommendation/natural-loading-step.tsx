import type { CSSProperties } from "react";
import type { AnonymousAdContext } from "../../contracts/advertising";
import { RecommendationWaitingScreen } from "../advertising/recommendation-waiting-screen";

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

export function NaturalLoadingStep({
  step,
  context,
}: {
  step: NaturalLoadingStepName;
  context?: AnonymousAdContext;
}) {
  const isMatching = step === "matching";

  return (
    <main
      className="relative isolate flex w-full flex-1 items-center justify-center overflow-hidden py-10"
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

      <section className="relative z-10 w-full" aria-label="추천 생성 진행 상황">
        <RecommendationWaitingScreen
          stage={isMatching ? 1 : 0}
          theme="dark"
          context={context}
        />
      </section>
    </main>
  );
}
