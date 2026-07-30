import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { MyView } from "@/components/my-view";

export const metadata: Metadata = {
  title: "MY",
};

export default function MyPage() {
  return (
    <AppShell active="my">
      <div className="page-shell">
        <MyView />
      </div>
    </AppShell>
  );
}
