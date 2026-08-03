import type { Metadata, Viewport } from "next";
import { NaturalRecommendationFlow } from "@/components/natural-recommendation/natural-recommendation-flow";

export const metadata: Metadata = {
  title: "한마디 추천",
  description: "보고 싶은 작품을 한마디로 말하고, 해석한 조건과 추천 이유를 확인해 보세요.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0f1215",
  width: "device-width",
  initialScale: 1,
};

export default function PromptRecommendationPage() {
  return <NaturalRecommendationFlow />;
}
