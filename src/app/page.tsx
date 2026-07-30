import Link from "next/link";
import { AppShell } from "@/components/app-shell";

const supportedProviders = [
  "Netflix",
  "TVING",
  "Disney+",
  "Wavve",
  "WATCHA",
  "Coupang Play",
];

const previewTitles = [
  { title: "나이브스 아웃", meta: "미스터리 · 130분", tone: "#6a4df5" },
  { title: "리틀 포레스트", meta: "드라마 · 103분", tone: "#168c7c" },
  { title: "극한직업", meta: "코미디 · 111분", tone: "#ef6c56" },
];

export default function HomePage() {
  return (
    <AppShell minimal>
      <section className="landing-hero">
        <div className="landing-hero__glow" aria-hidden="true" />
        <div className="landing-hero__inner">
          <div className="landing-copy">
            <p className="eyebrow">
              <span>NEW</span>
              결정하는 OTT 추천
            </p>
            <h1>
              오늘 볼 작품,
              <br />
              <em>1분 안에 결정해요.</em>
            </h1>
            <p className="landing-copy__lead">
              구독 중인 OTT와 지금 기분만 알려주세요. 조건을 몰래 바꾸지
              않고, 딱 5편과 고른 이유까지 보여드릴게요.
            </p>
            <div className="landing-actions">
              <Link href="/login" className="button button--primary button--large">
                Demo 시작하기 <span aria-hidden="true">→</span>
              </Link>
              <a href="#transparent" className="button button--ghost button--large">
                추천 원칙 보기
              </a>
            </div>
            <div className="landing-proof" aria-label="데모 실행 조건">
              <span>✓ 로그인 키 없음</span>
              <span>✓ DB 없음</span>
              <span>✓ AI 키 없음</span>
            </div>
          </div>

          <div className="landing-demo" aria-label="추천 결과 미리보기">
            <div className="landing-demo__topbar">
              <div>
                <span className="demo-live-dot" />
                <strong>지금 조건을 지키는 중</strong>
              </div>
              <span>Demo</span>
            </div>
            <div className="landing-demo__prompt">
              <p>오늘은 이렇게 볼게요</p>
              <div>
                <span>혼자</span>
                <span>긴장감 있게</span>
                <span>2시간 안에</span>
              </div>
            </div>
            <div className="landing-demo__result-head">
              <div>
                <small>TOP PICKS</small>
                <h2>이 3편부터 볼까요?</h2>
              </div>
              <span className="verified-badge">정책 확인 완료</span>
            </div>
            <div className="landing-poster-row">
              {previewTitles.map((item, index) => (
                <article
                  className="landing-poster"
                  key={item.title}
                  style={{ "--preview-tone": item.tone } as React.CSSProperties}
                >
                  <div className="landing-poster__art">
                    <span>{index === 0 ? "✦" : index === 1 ? "◐" : "◇"}</span>
                    <strong>{item.title}</strong>
                  </div>
                  <p>{item.title}</p>
                  <small>{item.meta}</small>
                </article>
              ))}
            </div>
            <div className="landing-demo__trace">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>조건과 안전 기준을 두 번 확인했어요</strong>
                <small>필수 필터 → 점수 → 다양성 → 최종 정책 검사</small>
              </div>
            </div>
          </div>
        </div>
        <div className="provider-marquee" aria-label="지원 OTT 예시">
          <span>지원 OTT</span>
          {supportedProviders.map((provider) => (
            <strong key={provider}>{provider}</strong>
          ))}
        </div>
      </section>

      <section className="trust-section" id="transparent">
        <div className="section-heading">
          <p className="eyebrow">WHY OTT DAMOA</p>
          <h2>AI의 결과보다, 지켜야 할 과정을 먼저 설계했어요.</h2>
          <p>
            추천 엔진이 무엇으로 바뀌어도 안전·예산·승인 규칙은 실행기
            바깥에서 똑같이 작동합니다.
          </p>
        </div>
        <ol className="principle-grid">
          <li>
            <span>01</span>
            <div className="principle-icon principle-icon--blue">⌕</div>
            <h3>필수 조건 먼저</h3>
            <p>연령, 구독 OTT, 시청 시간을 검색보다 먼저 확인해요.</p>
          </li>
          <li>
            <span>02</span>
            <div className="principle-icon principle-icon--teal">◇</div>
            <h3>조건 완화는 승인 후</h3>
            <p>결과가 부족해도 몰래 넓히지 않고 먼저 물어봐요.</p>
          </li>
          <li>
            <span>03</span>
            <div className="principle-icon principle-icon--violet">✦</div>
            <h3>마지막 안전 검사</h3>
            <p>응답 직전 한 번 더 검사하고 차단 사실도 숨기지 않아요.</p>
          </li>
          <li>
            <span>04</span>
            <div className="principle-icon principle-icon--amber">↯</div>
            <h3>예산 초과도 우아하게</h3>
            <p>AI 호출이 멈춰도 같은 조건의 규칙 추천으로 이어가요.</p>
          </li>
        </ol>
      </section>
    </AppShell>
  );
}
