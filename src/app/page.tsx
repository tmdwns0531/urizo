import type { Metadata, Viewport } from "next";
import { LandingPage } from "@/components/landing";

export const metadata: Metadata = {
  title: "오늘 볼 작품을 고르는 가장 짧은 방법",
  description:
    "지금 상황과 이용 중인 OTT를 바탕으로, 조건을 지키는 작품 5편과 추천 이유를 확인해 보세요.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#10151b",
  width: "device-width",
  initialScale: 1,
};

export default function HomePage() {
  return <LandingPage />;
}
