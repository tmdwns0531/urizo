import type { Metadata } from "next";
import { AppShell, PageIntro } from "@/components/app-shell";
import { ChoiceForm } from "@/components/choice-form";
import { readMvpAdapterConfig } from "@/config/adapters";

export const metadata: Metadata = {
  title: "CHOICE",
};

export default function ChoicePage() {
  const config = readMvpAdapterConfig();
  return (
    <AppShell active="choice">
      <div className="page-shell">
        <div className="choice-page-heading">
          <PageIntro
            eyebrow="MAKE YOUR CHOICE"
            title="지금 어떤 걸 보고 싶나요?"
            description="원하는 조건을 골라 주세요. 고른 조건은 추천이 끝날 때까지 그대로 지킵니다."
          />
          <div className="choice-progress" aria-label="추천 진행 1단계">
            <span className="is-active">1</span>
            <i />
            <span>2</span>
            <i />
            <span>3</span>
            <small>조건 선택 · 추천 확인 · 시청 결정</small>
          </div>
        </div>
        <ChoiceForm demoLabEnabled={config.appProfile === "demo"} />
      </div>
    </AppShell>
  );
}
