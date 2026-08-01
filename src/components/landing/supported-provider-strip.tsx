import { SUPPORTED_PROVIDERS } from "./landing-data";

export function SupportedProviderStrip() {
  return (
    <section
      className="cinema-provider-strip overflow-hidden border-b border-white/10 bg-[#0d1218] px-4 py-6 sm:px-6 sm:py-8"
      aria-labelledby="provider-strip-title"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="shrink-0 text-center lg:text-left">
          <h2 id="provider-strip-title" className="text-xs font-bold tracking-[0.16em] text-slate-400">
            이용 중인 OTT만 골라서
          </h2>
          <p className="mt-1 text-xs text-slate-600">선택한 서비스의 조건을 추천에 반영해요</p>
        </div>
        <ul className="cinema-provider-list flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:gap-x-9 lg:w-auto lg:justify-end">
          {SUPPORTED_PROVIDERS.map((provider) => (
            <li key={provider} className="text-sm font-extrabold tracking-[-0.02em] text-slate-300 sm:text-base">
              {provider}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
