import type {
  AdPlacement,
  AnonymousAdContext,
  SponsoredCampaignCreative,
} from "../../contracts/advertising";

type BillingModel = "CPM" | "CPV" | "CPC" | "CPA";

type ApprovedCampaign = {
  id: string;
  approvalStatus: "APPROVED";
  remainingBudgetWon: number;
  billingModels: BillingModel[];
  placements: AdPlacement[];
  targeting: {
    genres: string[];
    moods: string[];
    childSafe: boolean;
  };
  creative: SponsoredCampaignCreative;
};

const APPROVED_CAMPAIGNS: readonly ApprovedCampaign[] = [
  {
    id: "fictional-orbiel-blue-mailbox",
    approvalStatus: "APPROVED",
    remainingBudgetWon: 4_800_000,
    billingModels: ["CPM", "CPV", "CPC", "CPA"],
    placements: ["WAITING", "RESULT"],
    targeting: {
      genres: ["애니메이션", "코미디", "가족"],
      moods: ["밝은", "따뜻한"],
      childSafe: true,
    },
    creative: {
      id: "fictional-orbiel-blue-mailbox",
      workTitle: "오르비엘의 푸른 우편함",
      campaignTitle: "느긋한 저녁의 스폰서 셀렉션",
      posterUrl: "/sponsored-stillwater.svg",
      detailUrl: "/",
    },
  },
  {
    id: "fictional-lumea-glass-forest",
    approvalStatus: "APPROVED",
    remainingBudgetWon: 3_200_000,
    billingModels: ["CPM", "CPV", "CPC"],
    placements: ["WAITING", "RESULT"],
    targeting: {
      genres: ["애니메이션", "액션", "판타지", "SF/판타지"],
      moods: ["긴장감 있는", "감성적인"],
      childSafe: false,
    },
    creative: {
      id: "fictional-lumea-glass-forest",
      workTitle: "루메아의 유리숲 산책",
      campaignTitle: "고요한 판타지 스폰서 컬렉션",
      posterUrl: "/sponsored-evening-garden.svg",
      detailUrl: "/",
    },
  },
] as const;

function overlapScore(values: readonly string[], targets: readonly string[]) {
  return values.reduce(
    (score, value) => score + (targets.includes(value) ? 1 : 0),
    0,
  );
}

function stableNumber(value: string) {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  }
  return hash;
}

export function selectApprovedCampaign(input: {
  placement: AdPlacement;
  context: AnonymousAdContext;
  selectionKey: string;
}): SponsoredCampaignCreative | null {
  const childSafeRequired = input.context.companions.includes("WITH_CHILDREN");
  const eligible = APPROVED_CAMPAIGNS.filter(
    (campaign) =>
      campaign.approvalStatus === "APPROVED" &&
      campaign.remainingBudgetWon > 0 &&
      campaign.placements.includes(input.placement) &&
      (!childSafeRequired || campaign.targeting.childSafe),
  );

  const selected = eligible
    .map((campaign) => ({
      campaign,
      score:
        overlapScore(input.context.desiredGenres, campaign.targeting.genres) *
          5 +
        overlapScore(input.context.moods, campaign.targeting.moods) * 3 +
        (stableNumber(`${input.selectionKey}:${campaign.id}`) % 3),
    }))
    .sort((left, right) => right.score - left.score)[0]?.campaign;

  if (!selected) return null;

  return selected.creative;
}
