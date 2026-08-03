import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { RecommendationView } from "@/components/recommendation-view";

export const metadata: Metadata = {
  title: "추천 결과",
};

export default async function RecommendationPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  return (
    <AppShell active="results">
      <RecommendationView runId={runId} />
    </AppShell>
  );
}
