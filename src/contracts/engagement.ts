export const ENGAGEMENT_TYPES = [
  "BOOKMARK",
  "UNBOOKMARK",
  "WATCHED",
  "NOT_INTERESTED",
  "OTT_CLICK",
] as const;

export type EngagementType = (typeof ENGAGEMENT_TYPES)[number];

/** @deprecated Engagement is outside the v0.6 anonymous MVP. */
export interface EngagementEvent {
  id: string;
  userId: string;
  contentId: string;
  type: EngagementType;
  createdAt: string;
  runId?: string;
  provider?: string;
}

/** @deprecated Engagement is outside the v0.6 anonymous MVP. */
export type EngagementEventInput = Omit<EngagementEvent, "id" | "createdAt">;

/**
 * Public service command. The authenticated user is resolved server-side and
 * must never be accepted from a browser request.
 */
export type EngagementCommand = Omit<EngagementEventInput, "userId">;
