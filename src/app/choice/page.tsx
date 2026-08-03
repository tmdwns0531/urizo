import type { Metadata, Viewport } from "next";
import { ChoiceForm } from "@/components/choice-form";

export const metadata: Metadata = {
  title: "조건 선택",
  description: "단계별로 시청 조건을 고르고 다섯 편을 추천받아 보세요.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0f1215",
};

export default function ChoicePage() {
  return <ChoiceForm />;
}
