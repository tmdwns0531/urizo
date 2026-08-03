import type { OttProvider } from "./catalog";
import type { Companion, Mood } from "./mvp-search";

export const AD_PLACEMENTS = ["WAITING", "RESULT"] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

/**
 * Context allowed across the public ad-selection boundary. It deliberately
 * excludes identity, natural-language input, prompts, and recommendation IDs.
 */
export interface AnonymousAdContext {
  selectedProviders: OttProvider[];
  companions: Companion[];
  moods: Mood[];
  desiredGenres: string[];
}

export interface AdSelectionRequest {
  placement: AdPlacement;
  runId?: string;
  context?: AnonymousAdContext;
}

/** Only fields needed to render a clearly labeled sponsored creative. */
export interface SponsoredCampaignCreative {
  id: string;
  workTitle: string;
  campaignTitle: string;
  posterUrl: string;
  detailUrl: string;
}

export interface AdSelectionResponse {
  campaign: SponsoredCampaignCreative | null;
}

export const AD_MEASUREMENT_EVENTS = ["IMPRESSION", "CLICK"] as const;
export type AdMeasurementEvent = (typeof AD_MEASUREMENT_EVENTS)[number];

export interface AdMeasurementRequest {
  campaignId: string;
  placement: AdPlacement;
  event: AdMeasurementEvent;
}
