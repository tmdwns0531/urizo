import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import { WatchlistView } from "@/components/watchlist/watchlist-view";

export const metadata: Metadata = {
  title: "찜 목록",
  description: "찜한 작품을 모아 보고, 어느 OTT를 구독하면 좋을지 확인하세요.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0f1215",
};

export default function WatchlistPage() {
  return (
    <AppShell>
      <WatchlistView />
    </AppShell>
  );
}
