import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "파트너 프로모션",
  description: "OTT 다모아의 데모용 파트너 프로모션 페이지입니다.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0f1215",
};

const promotions = {
  lumia: {
    title: "루미아의 유리숲 산책",
    posterUrl: "/lumia-glass-forest-poster.webp",
    partnerUrl: "/partner-demo.html?campaign=lumia",
  },
  orbiel: {
    title: "오르비엘의 푸른 우편함",
    posterUrl: "/sponsored-stillwater.svg",
    partnerUrl: "/partner-demo.html?campaign=orbiel",
  },
} as const;

export default async function SponsorDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const { campaign } = await searchParams;
  const promotion = campaign === "orbiel" ? promotions.orbiel : promotions.lumia;

  return (
    <AppShell minimal>
      <section className="app-container grid min-h-[calc(100dvh-4rem)] place-items-center py-10 sm:py-16">
        <article className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#171b21] shadow-[0_28px_90px_rgba(0,0,0,.35)] lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)]">
          <div className="relative min-h-72 overflow-hidden bg-[#10151b] lg:min-h-[38rem]">
            {/* Demo creatives are static and intentionally bypass image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={promotion.posterUrl}
              alt={`${promotion.title} 프로모션 포스터`}
              className="size-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-6 pb-6 pt-20">
              <p className="text-sm font-black tracking-[-0.02em] text-white">
                {promotion.title}
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-12">
            <p className="text-sm font-black tracking-[0.14em] text-orange-300">
              파트너 프로모션
            </p>
            <h1 className="mt-4 text-balance text-3xl font-black leading-tight tracking-[-0.05em] text-white sm:text-5xl">
              {promotion.title}을
              <br />
              지금 파트너 서비스에서 만나보세요.
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-300">
              작품 소개와 프로모션 정보를 확인해 보세요.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href={promotion.partnerUrl}
                target="_blank"
                rel="noreferrer sponsored"
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[#ff5430] to-[#ff7c42] px-6 text-sm font-black text-white shadow-[0_12px_32px_rgba(255,89,45,.22)] transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                aria-label="가상 파트너 사이트에서 보기, 새 창"
              >
                파트너 사이트에서 보기 ↗
              </a>
              <Link
                href="/"
                className="inline-flex min-h-12 items-center text-sm font-black text-slate-300 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
              >
                OTT 다모아로 돌아가기
              </Link>
            </div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
