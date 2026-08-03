import Link from "next/link";

import type { CatalogContent, OttProvider } from "@/contracts/catalog";
import type {
  ComparisonRecommendation,
  ContentComparisonResult,
} from "@/contracts/content-comparison";
import { AppShell, BrandMark } from "@/components/app-shell";
import { PosterArt } from "@/components/poster-art";
import { ProviderBadge } from "@/components/provider-badge";
import styles from "./content-comparison-page.module.css";

type ContentComparisonOption = Pick<
  CatalogContent,
  "id" | "title" | "releaseYear" | "mediaType"
>;

type ContentComparisonPageProps = {
  options: ContentComparisonOption[];
  comparison: ContentComparisonResult;

};

function mediaLabel(content: CatalogContent): string {
  return content.mediaType === "MOVIE"
    ? `영화 · ${content.runtimeMinutes}분`
    : `시리즈 · 회당 ${content.runtimeMinutes}분`;
}

function ageLabel(content: CatalogContent): string {
  if (content.ageRating === "ALL") return "전체 관람가";
  return `${content.ageRating}세 관람가`;
}

function pickerLabel(content: ContentComparisonOption): string {
  const media = content.mediaType === "MOVIE" ? "영화" : "시리즈";
  return `${content.title} (${content.releaseYear} · ${media})`;
}

function winnerLabel(
  recommendation: ComparisonRecommendation,
  comparison: ContentComparisonResult,
): string {
  if (recommendation.winner === "TIE") {
    const isMixedRuntime =
      recommendation.key === "QUICK_WATCH" &&
      comparison.left.mediaType !== comparison.right.mediaType;
    return isMixedRuntime ? "직접 비교 어려움" : "두 작품 비슷함";
  }

  return recommendation.winnerContentId === comparison.left.id
    ? comparison.left.title
    : comparison.right.title;
}

function ContentSummaryCard({
  content,
  side,
}: {
  content: CatalogContent;
  side: "A" | "B";
}) {
  return (
    <article className={styles.contentCard}>
      <div className={styles.cardLabel}>작품 {side}</div>
      <div className={styles.posterFrame}>
        <PosterArt content={content} priority />
      </div>
      <div className={styles.contentBody}>
        <div>
          <p className={styles.contentMeta}>
            {content.releaseYear} · {mediaLabel(content)} · {ageLabel(content)}
          </p>
          <h2>{content.title}</h2>
        </div>
        <div className={styles.providerList} aria-label="제공 OTT">
          {content.providers.map(({ provider }) => (
            <ProviderBadge
              key={provider}
              provider={provider as OttProvider}
              compact
            />
          ))}
        </div>
        <p className={styles.synopsis}>{content.synopsis}</p>
        <div className={styles.chipList} aria-label="장르">
          {content.genres.map((genre) => (
            <span key={genre}>{genre}</span>
          ))}
        </div>
        <p className={styles.rating}>
          ★ {content.voteAverage.toFixed(1)} · {content.voteCount.toLocaleString("ko-KR")}개 평가
        </p>
      </div>
    </article>
  );
}

export function ComparisonHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#10151b]/85 backdrop-blur-xl">
      <nav className="app-container flex h-16 items-center gap-3 sm:h-[4.5rem]" aria-label="작품 비교 메뉴">
        <Link href="/" className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff7043]" aria-label="OTT 다모아 홈">
          <BrandMark inverse />
        </Link>
        <Link href="/choice" className="ml-auto text-sm font-extrabold text-orange-300 transition hover:text-orange-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400">
          바로 추천받기
        </Link>
      </nav>
    </header>
  );
}

export function ContentComparisonPage({
  options,
  comparison,

}: ContentComparisonPageProps) {
  const swapHref = `/compare?left=${encodeURIComponent(comparison.right.id)}&right=${encodeURIComponent(comparison.left.id)}`;



  return (
    <AppShell minimal header={<ComparisonHeader />}>
      <div className={styles.page}>
        <section className={`${styles.hero} app-container`}>
          <p className={styles.eyebrow}>CONTENT COMPARISON</p>
          <h1>두 작품, 같은 점부터 다른 선택까지</h1>
          <p className={styles.heroDescription}>
            카탈로그의 검증된 정보만 코드로 비교해요. 별도 RAG나 LLM 추측 없이
            공통점, 차이점, 상황별 선택 기준을 확인할 수 있어요.
          </p>
        </section>

        <section className={`${styles.selectorSection} app-container`} aria-labelledby="comparison-picker-title">
          <form action="/compare" method="get">
          <div className={styles.sectionHeading}>
            <div>
              <p>STEP 1</p>
              <h2 id="comparison-picker-title">비교할 두 작품 선택</h2>
            </div>
            <Link
              href={swapHref}
              className={styles.swapButton}


            >
              A · B 위치 바꾸기
            </Link>
          </div>

          <div className={styles.selectorGrid}>
            <label className={styles.selectField}>
              <span>작품 A</span>
              <select
                name="left"
                defaultValue={comparison.left.id}
                required
              >
                <option value="">첫 번째 작품을 선택하세요</option>
                {options.map((content) => (
                  <option
                    key={content.id}
                    value={content.id}

                  >
                    {pickerLabel(content)}
                  </option>
                ))}
              </select>
            </label>
            <span className={styles.vsMark} aria-hidden="true">VS</span>
            <label className={styles.selectField}>
              <span>작품 B</span>
              <select
                name="right"
                defaultValue={comparison.right.id}
                required
              >
                <option value="">두 번째 작품을 선택하세요</option>
                {options.map((content) => (
                  <option
                    key={content.id}
                    value={content.id}

                  >
                    {pickerLabel(content)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.selectorActions}>
            <button type="submit" className={styles.submitButton}>
              선택한 두 작품 비교하기
            </button>
          </div>
          </form>
        </section>


          <div className={`${styles.results} app-container`}>
            <section className={styles.comparisonCards} aria-label="선택한 작품">
              <ContentSummaryCard content={comparison.left} side="A" />
              <div className={styles.centerVs} aria-hidden="true">VS</div>
              <ContentSummaryCard content={comparison.right} side="B" />
            </section>

            <section className={styles.resultSection} aria-labelledby="common-title">
              <div className={styles.sectionHeading}>
                <div>
                  <p>COMMON</p>
                  <h2 id="common-title">공통점</h2>
                </div>
                <span>{comparison.commonalities.length}개 확인</span>
              </div>
              <div className={styles.commonGrid}>
                {comparison.commonalities.map((item) => (
                  <article key={item.key} className={styles.commonCard}>
                    <span aria-hidden="true">✓</span>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.resultSection} aria-labelledby="difference-title">
              <div className={styles.sectionHeading}>
                <div>
                  <p>DIFFERENT</p>
                  <h2 id="difference-title">차이점</h2>
                </div>
                <span>구조화 항목 기준</span>
              </div>
              <div className={styles.differenceTable}>
                <div className={styles.tableHeader} aria-hidden="true">
                  <span>비교 항목</span>
                  <span>{comparison.left.title}</span>
                  <span>{comparison.right.title}</span>
                </div>
                {comparison.differences.map((item) => (
                  <article key={item.key} className={styles.differenceRow}>
                    <div className={styles.differenceLabel}>
                      <strong>{item.label}</strong>
                      <p>{item.description}</p>
                    </div>
                    <div data-label={comparison.left.title}>
                      <span className="sr-only">{comparison.left.title}: </span>
                      {item.leftValue}
                    </div>
                    <div data-label={comparison.right.title}>
                      <span className="sr-only">{comparison.right.title}: </span>
                      {item.rightValue}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.resultSection} aria-labelledby="recommendation-title">
              <div className={styles.sectionHeading}>
                <div>
                  <p>WHEN TO WATCH</p>
                  <h2 id="recommendation-title">상황별 추천</h2>
                </div>
                <span>고정 규칙 · 같은 입력은 같은 결과</span>
              </div>
              <div className={styles.recommendationGrid}>
                {comparison.recommendations.map((item) => (
                  <article
                    key={item.key}
                    className={`${styles.recommendationCard} ${
                      item.winner === "TIE" ? styles.tieCard : ""
                    }`}
                  >
                    <p>{item.label}</p>
                    <h3>{winnerLabel(item, comparison)}</h3>
                    <span>{item.description}</span>
                  </article>
                ))}
              </div>
            </section>

            <aside className={styles.notice}>
              <strong>비교 기준 안내</strong>
              <p>
                평점·평가 수는 카탈로그의 TMDB 값을 사용합니다. 줄거리의 숨은
                의미나 작품의 우열을 추측하지 않으며, 추천은 상영시간·관람등급·
                OTT 수·평점과 평가 수 지표·잔잔한 분위기 태그에 정해진 규칙을 적용한 선택
                가이드예요.
              </p>
            </aside>
          </div>






      </div>
    </AppShell>
  );
}
