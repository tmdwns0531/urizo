import type { Metadata } from "next";
import Link from "next/link";
import { AppShell, BrandMark } from "@/components/app-shell";
import { ProviderBadge } from "@/components/provider-badge";

export const metadata: Metadata = {
  title: "Demo 로그인",
};

export default function LoginPage() {
  return (
    <AppShell minimal>
      <section className="auth-page">
        <div className="auth-page__visual">
          <div className="auth-visual__content">
            <BrandMark inverse />
            <p className="eyebrow eyebrow--inverse">SEARCH LESS, WATCH MORE</p>
            <h1>
              고르는 시간은 줄이고,
              <br />
              보는 시간은 늘리세요.
            </h1>
            <p>
              외부 계정 없이도 추천·승인·정책 차단·폴백 흐름을 모두
              확인할 수 있는 로컬 Demo입니다.
            </p>
            <div className="auth-visual__steps" aria-label="Demo 흐름">
              <span>1. 조건 선택</span>
              <span>2. 정책 확인</span>
              <span>3. 5편 결정</span>
            </div>
          </div>
          <div className="auth-orbit auth-orbit--one" aria-hidden="true" />
          <div className="auth-orbit auth-orbit--two" aria-hidden="true" />
        </div>

        <div className="auth-page__panel">
          <div className="auth-card">
            <p className="eyebrow">WELCOME</p>
            <h2>Demo 사용자로 시작할게요</h2>
            <p className="auth-card__description">
              환경변수와 외부 서비스 없이 준비된 프로필을 사용합니다.
            </p>
            <div className="demo-user-card">
              <div className="demo-user-card__avatar">민</div>
              <div>
                <strong>김민지</strong>
                <span>29세 · 선택에 지친 직장인</span>
              </div>
              <span className="status-chip status-chip--safe">Demo</span>
            </div>
            <div className="demo-user-providers">
              <span>구독 중</span>
              <div>
                <ProviderBadge provider="NETFLIX" compact />
                <ProviderBadge provider="TVING" compact />
                <ProviderBadge provider="DISNEY_PLUS" compact />
              </div>
            </div>
            <Link
              href="/choice"
              className="button button--primary button--block button--large"
            >
              이 프로필로 바로 시작
              <span aria-hidden="true">→</span>
            </Link>
            <Link href="/onboarding" className="button button--subtle button--block">
              프로필부터 둘러보기
            </Link>
            <p className="auth-card__footnote">
              실제 OAuth는 <code>AUTH_ADAPTER</code>를 바꿔 독립적으로 연결할
              수 있어요.
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
