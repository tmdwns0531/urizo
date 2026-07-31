import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const imageUrl = new URL("/og.png", metadataBase).toString();

  return {
    metadataBase,
    title: {
      default: "OTT 다모아",
      template: "%s · OTT 다모아",
    },
    description:
      "볼 수 있는 OTT 안에서 지금 볼 작품 5편을 고르고, 추천 과정과 안전 정책까지 확인하는 익명 추천 서비스.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "OTT 다모아 — 오늘 볼 작품, 1분 안에",
      description: "검색보다 결정. 조건을 지키는 투명한 OTT 추천 서비스.",
      type: "website",
      locale: "ko_KR",
      images: [{ url: imageUrl, width: 1732, height: 908 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "OTT 다모아 — 오늘 볼 작품, 1분 안에",
      description: "검색보다 결정. 조건을 지키는 투명한 OTT 추천 서비스.",
      images: [imageUrl],
    },
  };
}

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f5f7fb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
