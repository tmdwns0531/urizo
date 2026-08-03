import { OTT_PROVIDERS, type OttProvider } from "../../contracts/catalog";

/**
 * 찜한 작품 하나. 추천 응답에서 그대로 뽑아 브라우저에 저장한다.
 *
 * 카탈로그 전체를 다시 조회하지 않으려고 `providers` 를 함께 담는다. 커버리지
 * 계산에 필요한 것이 그 목록뿐이라, 저장해 두면 서버 왕복 없이 화면에서
 * 바로 계산할 수 있다.
 */
export type WatchlistEntry = {
  id: string;
  title: string;
  posterUrl: string | null;
  providers: OttProvider[];
};

/** OTT 하나만 구독했을 때의 커버리지. */
export type ProviderReach = {
  provider: OttProvider;
  count: number;
  titles: string[];
};

/** 구독을 하나씩 늘려갈 때의 누적. `added` 가 0 이면 더 넣을 이유가 없다. */
export type CoverageStep = {
  provider: OttProvider;
  added: number;
  total: number;
};

export type CoveragePlan = {
  saved: number;
  /** 단독 커버리지 내림차순. */
  single: ProviderReach[];
  /** 이득이 큰 순서로 쌓은 조합. 이득이 없어지면 거기서 끊는다. */
  steps: CoverageStep[];
  /** 어느 OTT 에서도 볼 수 없는 작품. */
  uncovered: WatchlistEntry[];
};

/**
 * 동점일 때 순서가 흔들리지 않도록 고정 순위를 쓴다. 화면을 다시 그릴 때마다
 * OTT 순서가 바뀌면 사용자는 목록이 갱신된 줄로 읽는다.
 */
const PROVIDER_ORDER = new Map<OttProvider, number>(
  OTT_PROVIDERS.map((provider, index) => [provider, index]),
);

const rank = (provider: OttProvider): number =>
  PROVIDER_ORDER.get(provider) ?? Number.MAX_SAFE_INTEGER;

/** 저장된 값이 낡아 지금은 없는 OTT 를 담고 있을 수 있어 걸러 쓴다. */
const knownProviders = (entry: WatchlistEntry): OttProvider[] =>
  entry.providers.filter((provider) => PROVIDER_ORDER.has(provider));

/**
 * 찜 목록으로 "어느 OTT 를 구독하면 되는가" 를 계산한다.
 *
 * 조합은 최적해가 아니라 탐욕법이다. 매 단계에서 아직 못 보는 작품을 가장 많이
 * 덮는 OTT 를 고른다. 집합 덮개 문제의 최적해는 OTT 6 개면 구할 수도 있지만,
 * 화면에 필요한 답은 "다음에 뭘 더하면 가장 이득인가" 라서 탐욕법이 그대로
 * 그 질문의 답이 된다. 단계마다 이득을 함께 보여주므로 사용자가 어디서 멈출지
 * 스스로 정할 수 있다.
 */
export function buildCoveragePlan(
  entries: readonly WatchlistEntry[],
): CoveragePlan {
  const single: ProviderReach[] = OTT_PROVIDERS.map((provider) => {
    const titles = entries
      .filter((entry) => knownProviders(entry).includes(provider))
      .map((entry) => entry.title);
    return { provider, count: titles.length, titles };
  })
    .filter((reach) => reach.count > 0)
    .sort((a, b) => b.count - a.count || rank(a.provider) - rank(b.provider));

  const uncovered = entries.filter((entry) => knownProviders(entry).length === 0);

  const steps: CoverageStep[] = [];
  const remaining = new Set(
    entries.filter((entry) => knownProviders(entry).length > 0).map((e) => e.id),
  );
  const used = new Set<OttProvider>();
  let total = 0;

  while (remaining.size > 0) {
    let best: { provider: OttProvider; covered: string[] } | null = null;
    for (const provider of OTT_PROVIDERS) {
      if (used.has(provider)) continue;
      const covered = entries
        .filter(
          (entry) =>
            remaining.has(entry.id) && knownProviders(entry).includes(provider),
        )
        .map((entry) => entry.id);
      if (
        covered.length > 0 &&
        (best === null ||
          covered.length > best.covered.length ||
          (covered.length === best.covered.length &&
            rank(provider) < rank(best.provider)))
      ) {
        best = { provider, covered };
      }
    }
    if (best === null) break;
    for (const id of best.covered) remaining.delete(id);
    used.add(best.provider);
    total += best.covered.length;
    steps.push({
      provider: best.provider,
      added: best.covered.length,
      total,
    });
  }

  return { saved: entries.length, single, steps, uncovered };
}
