import Link from "next/link";
import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell";
import {
  ComparisonHeader,
  ContentComparisonPage,
} from "@/components/content-comparison/content-comparison-page";
import { loadContentComparisonCatalog } from "@/composition/content-comparison";
import {
  compareCatalogContents,
  getComparableCatalog,
  pickDefaultComparisonIds,
} from "@/domains/content-comparison/compare";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "작품 비교",
  description:
    "두 작품의 공통점, 차이점, 상황별 선택 기준을 검증된 카탈로그 정보로 비교해 보세요.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0f1215",
};

type ComparePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return value?.trim() || null;
}

function UnavailableComparison({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <AppShell minimal header={<ComparisonHeader />}>
      <div className="app-container flex min-h-[70vh] items-center justify-center py-16">
        <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#151c23] p-8 text-center shadow-2xl">
          <p className="text-sm font-black tracking-[0.18em] text-orange-300">
            CONTENT COMPARISON
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">
            {title}
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-400">
            {description}
          </p>
          <Link href="/compare" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#ff6b3d] px-5 text-sm font-extrabold text-white transition hover:bg-[#ff7d56] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-white">
            기본 비교로 돌아가기
          </Link>
        </section>
      </div>
    </AppShell>
  );
}

async function loadComparisonPageData(
  searchParams: ComparePageProps["searchParams"],
) {
  try {
    const [rawCatalog, params] = await Promise.all([
      loadContentComparisonCatalog(),
      searchParams,
    ]);
    return { contents: getComparableCatalog(rawCatalog), params };
  } catch {
    return null;
  }
}

export default async function ComparePage({ searchParams }: ComparePageProps) {
  const data = await loadComparisonPageData(searchParams);

  if (!data) {
    return (
      <UnavailableComparison
        title="작품 정보를 불러오지 못했어요"
        description="잠시 뒤 다시 시도해 주세요. 연결 정보나 내부 오류 원문은 화면에 표시하지 않습니다."
      />
    );
  }

  const { contents, params } = data;
  const defaults = pickDefaultComparisonIds(contents);

  if (!defaults) {
    return (
      <UnavailableComparison
        title="비교할 수 있는 작품이 부족해요"
        description="익명 안전 조건과 국내 OTT 제공 조건을 통과한 작품이 두 편 이상 필요합니다."
      />
    );
  }

  const contentIds = new Set(contents.map(({ id }) => id));
  const requestedLeft = firstValue(params.left);
  const requestedRight = firstValue(params.right);
  const hasValidPair =
    requestedLeft !== null &&
    requestedRight !== null &&
    requestedLeft !== requestedRight &&
    contentIds.has(requestedLeft) &&
    contentIds.has(requestedRight);
  const hasRequestedPair = requestedLeft !== null || requestedRight !== null;

  if (hasRequestedPair && !hasValidPair) {
    return (
      <UnavailableComparison
        title="비교할 작품을 다시 선택해 주세요"
        description="서로 다른 안전한 작품 두 편을 모두 선택해야 합니다. 기본 비교로 돌아가 다시 선택해 주세요."
      />
    );
  }

  const selectedLeftId =
    hasValidPair && requestedLeft ? requestedLeft : defaults[0];
  const selectedRightId =
    hasValidPair && requestedRight ? requestedRight : defaults[1];
  const left = contents.find(({ id }) => id === selectedLeftId);
  const right = contents.find(({ id }) => id === selectedRightId);

  if (!left || !right) {
    return (
      <UnavailableComparison
        title="선택한 작품을 찾지 못했어요"
        description="안전 조건을 통과한 다른 작품 두 편을 선택해 주세요."
      />
    );
  }

  const options = contents.map(({
    id,
    title,
    releaseYear,
    mediaType,
  }) => ({ id, title, releaseYear, mediaType }));
  const comparison = compareCatalogContents(left, right);


  return (
    <ContentComparisonPage
      options={options}
      comparison={comparison}

    />
  );
}
