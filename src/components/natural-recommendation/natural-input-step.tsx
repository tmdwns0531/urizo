import { NATURAL_LANGUAGE_MAX_CODE_POINTS } from "../../contracts/mvp-search";
import {
  clampNaturalLanguage,
  countNaturalLanguageCodePoints,
} from "./natural-language";

const EXAMPLES = [
  "혼자 넷플릭스에서 2시간 안에 웃을 수 있는 영화",
  "아이와 디즈니+에서 볼 따뜻한 작품",
  "친구들과 티빙에서 긴장감 있는 한국 작품",
] as const;

export function NaturalInputStep({
  value,
  error,
  onChange,
  onSubmit,
}: {
  value: string;
  error: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const length = countNaturalLanguageCodePoints(value);

  return (
    <main className="mx-auto flex w-full max-w-[50rem] flex-1 items-start px-5 py-10 pb-20 sm:items-center sm:px-6 sm:py-16">
      <section className="w-full" aria-labelledby="natural-input-title">
        <header className="text-center">
          <p className="choice-stepper__eyebrow">한마디 추천 · Beta</p>
          <h1
            id="natural-input-title"
            className="mt-2 text-balance text-3xl font-black tracking-[-0.045em] text-white sm:text-5xl"
          >
            지금 보고 싶은 작품을
            <span className="mt-1 block text-orange-400">편하게 말해 주세요.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base sm:leading-7">
            시간, 함께 보는 사람, 이용할 OTT, 원하는 느낌을 한 문장에 모두
            적지 않아도 괜찮아요. 비어 있는 조건은 구분해서 보여드릴게요.
          </p>
        </header>

        <form
          className="mt-8 rounded-3xl border border-slate-700 bg-[#191d22] p-4 shadow-[0_24px_70px_rgba(0,0,0,.28)] sm:p-6"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label htmlFor="natural-request" className="sr-only">
            보고 싶은 작품 설명
          </label>
          <textarea
            id="natural-request"
            name="naturalRequest"
            rows={4}
            value={value}
            autoFocus
            placeholder="예: 아이와 넷플릭스에서 2시간 안에 볼 수 있는 따뜻한 한국 영화"
            aria-describedby="natural-request-help natural-request-count"
            aria-invalid={Boolean(error)}
            className="min-h-36 w-full resize-none rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-4 text-base leading-7 text-white outline-none placeholder:text-slate-600 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 sm:px-5 sm:text-lg"
            onChange={(event) => onChange(clampNaturalLanguage(event.target.value))}
          />
          <div className="mt-2 flex items-start justify-between gap-4 px-1 text-xs leading-5 text-slate-500">
            <p id="natural-request-help">개인정보나 계정 정보는 입력하지 마세요.</p>
            <p id="natural-request-count" className="shrink-0 tabular-nums">
              {length}/{NATURAL_LANGUAGE_MAX_CODE_POINTS}
            </p>
          </div>

          {error ? (
            <p className="choice-stepper-error" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={!value.trim()}
            className="mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff5430] to-[#ff7c42] px-6 py-3.5 text-base font-black text-white shadow-[0_12px_32px_rgba(255,89,45,.22)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:shadow-none"
          >
            이 한마디로 추천받기 <span aria-hidden="true">→</span>
          </button>
        </form>

        <div className="mt-7">
          <p className="text-center text-xs font-bold text-slate-500">
            이렇게 말해도 좋아요
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((example) => (
              <button
                type="button"
                key={example}
                className="min-h-11 rounded-full border border-slate-800 bg-white/[0.03] px-4 py-2 text-left text-xs font-semibold leading-5 text-slate-400 transition hover:border-slate-600 hover:text-slate-200 focus-visible:outline-orange-400 sm:text-sm"
                onClick={() => onChange(example)}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
