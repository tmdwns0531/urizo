import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { LoginForm } from "@/components/watchlist/login-form";

export const metadata: Metadata = {
  title: "로그인",
  description: "찜한 작품을 계정에 저장하고 어느 기기에서나 이어 보세요.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0f1215",
};

export default function LoginPage() {
  return (
    <AppShell>
      {/* useSearchParams 는 준비될 때까지 기다려야 한다. */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AppShell>
  );
}
