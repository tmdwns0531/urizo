import type { OttProvider } from "@/contracts/user";

export const providerLabels: Record<OttProvider, string> = {
  NETFLIX: "Netflix",
  TVING: "TVING",
  DISNEY_PLUS: "Disney+",
  WAVVE: "Wavve",
  WATCHA: "WATCHA",
  COUPANG_PLAY: "Coupang Play",
};

export function ProviderBadge({
  provider,
  compact = false,
}: {
  provider: OttProvider;
  compact?: boolean;
}) {
  return (
    <span
      className={`provider-badge provider-badge--${provider.toLowerCase()}${
        compact ? " provider-badge--compact" : ""
      }`}
    >
      {providerLabels[provider]}
    </span>
  );
}
