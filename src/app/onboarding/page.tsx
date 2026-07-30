import type { Metadata } from "next";
import { AppShell, PageIntro } from "@/components/app-shell";
import { OnboardingForm } from "@/components/onboarding-form";

export const metadata: Metadata = {
  title: "프로필 설정",
};

export default function OnboardingPage() {
  return (
    <AppShell minimal>
      <div className="page-shell page-shell--narrow">
        <PageIntro
          eyebrow="PROFILE SETUP"
          title="첫 추천을 위한 최소한만 물어볼게요."
          description="선택 정보는 언제든 건너뛰거나 MY에서 다시 바꿀 수 있어요."
        />
        <OnboardingForm />
      </div>
    </AppShell>
  );
}
