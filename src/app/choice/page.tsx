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
          {/* Static orientation copy. It must not read as live progress: the
              CHOICE page cannot observe the later steps. */}
          <div className="choice-guide">
            <strong>이렇게 진행돼요</strong>
            <ol>
              <li>
                <span>조건 고르기</span>
              </li>
              <li>
                <span>추천 5편 확인</span>
              </li>
              <li>
                <span>볼 작품 결정</span>
              </li>
            </ol>
          </div>
        </div>
        <ChoiceForm demoLabEnabled={config.appProfile === "demo"} />
      </div>
    </AppShell>
  );
}
