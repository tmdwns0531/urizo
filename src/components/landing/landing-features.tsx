import { LANDING_FEATURES, type LandingFeature } from "./landing-data";

function FeatureIcon({ id }: Pick<LandingFeature, "id">) {
  if (id === "context") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3a7 7 0 0 0-7 7c0 4.8 7 11 7 11s7-6.2 7-11a7 7 0 0 0-7-7Z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    );
  }

  if (id === "conditions") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M10 14v6" />
      </svg>
    );
  }

  if (id === "compare") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="7" height="14" rx="2" />
        <rect x="14" y="5" width="7" height="14" rx="2" />
        <path d="m6 15 2-2M17 10l2 2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-7l-4 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M7 9h10M7 13h6" />
    </svg>
  );
}

export function LandingFeatures() {
  return (
    <section
      id="how-it-works"
      className="cinema-features scroll-mt-20 border-b border-white/10 bg-[#0f141a] px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      aria-labelledby="features-title"
    >
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-xs font-bold tracking-[0.18em] text-[#66d9c0] sm:text-sm">추천할 때 지키는 네 가지 기준</p>
          <h2 id="features-title" className="mt-3 text-balance text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl lg:text-5xl">
            고른 조건을 지키면서 추천해요.
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
            시청 가능한 시간과 OTT를 먼저 확인하고, 원하는 느낌과 취향에
            맞는 작품을 골라드려요.
          </p>
        </div>

        <ol className="cinema-feature-grid mt-12 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:mt-16">
          {LANDING_FEATURES.map((feature) => (
            <li key={feature.id} className="group relative min-h-64 overflow-hidden rounded-2xl border border-white/10 bg-[#17202a] p-6 transition duration-300 hover:-translate-y-1 hover:border-white/20 sm:p-8">
              <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#48627a]/10 blur-2xl transition group-hover:bg-[#ff7043]/10" aria-hidden="true" />
              <div className="relative flex items-start justify-between gap-5">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition group-hover:border-[#ff7043]/30 group-hover:text-[#ff9273]">
                  <span className="block h-6 w-6 [&_circle]:stroke-current [&_path]:stroke-current [&_path]:stroke-[1.7] [&_rect]:stroke-current [&_rect]:stroke-[1.7]">
                    <FeatureIcon id={feature.id} />
                  </span>
                </span>
                <span className="text-xs font-extrabold tracking-[0.16em] text-slate-600" aria-hidden="true">{feature.step}</span>
              </div>
              <h3 className="relative mt-9 text-xl font-extrabold tracking-[-0.025em] text-white sm:text-2xl">{feature.title}</h3>
              <p className="relative mt-3 max-w-md text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">{feature.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
