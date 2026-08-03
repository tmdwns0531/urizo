import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createJiti } from "jiti";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const jiti = createJiti(import.meta.url, {
  moduleCache: false,
  alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
});
const load = (path) =>
  jiti.import(fileURLToPath(new URL(`../${path}`, import.meta.url)));

test("sponsored creative renders as a labeled static recommendation-style card", async () => {
  const ad = await read("src/components/advertising/sponsored-video-ad.tsx");

  for (const implementationDetail of [
    /<video\b/,
    /\bplaying\b/,
    /\bmuted\b/,
    /\belapsed\b/,
    /\bvideoUnavailable\b/,
    /\bvideoRef\b/,
    /\bstartedCampaign\b/,
    /\bcompletedCampaign\b/,
    /\bformatSeconds\b/,
    /\btogglePlayback\b/,
    /sponsored-ad__video-actions/,
    /sponsored-ad__playback/,
    /sponsored-ad__progress/,
    /영상 준비 안 됨/,
    /재생 중/,
    /일시 정지/,
  ]) {
    assert.doesNotMatch(ad, implementationDetail);
  }

  assert.match(ad, /<img\b/);
  assert.match(ad, /src=\{campaign\.posterUrl\}/);
  assert.match(
    ad,
    /alt=\{`\$\{campaign\.workTitle\}[^`]*포스터`\}/,
    "the static poster needs a work-specific accessible name",
  );
  assert.match(
    ad,
    /<img[\s\S]*?<span className="ad-label">광고<\/span>/,
    "the loaded poster must carry the existing advertising label",
  );
  assert.match(ad, /\{campaign\.workTitle\}/);
  assert.match(ad, /\{campaign\.campaignTitle\}/);
  assert.match(ad, /스폰서 콘텐츠/);
  assert.match(ad, /className="sponsored-ad__cta"/);
  assert.match(ad, /href=\{campaign\.detailUrl\}/);
  assert.match(ad, /자세히 보기/);
  assert.doesNotMatch(ad, /matchPercent|추천 순위|일치율|Agent|AI/);
});

test("sponsored creative keeps only impression and click measurements", async () => {
  const [ad, contract] = await Promise.all([
    read("src/components/advertising/sponsored-video-ad.tsx"),
    read("src/contracts/advertising.ts"),
  ]);

  assert.match(
    ad,
    /sendMeasurement\(selected\.id,\s*placement,\s*"IMPRESSION"\)/,
  );
  assert.match(
    ad,
    /onClick=\{\(\) =>\s*sendMeasurement\(campaign\.id,\s*placement,\s*"CLICK"\)\s*\}/,
  );
  assert.doesNotMatch(ad, /"VIDEO_START"|"VIDEO_COMPLETE"/);

  const creative =
    contract.match(
      /export interface SponsoredCampaignCreative[\s\S]*?\n\}/,
    )?.[0] ?? "";
  assert.doesNotMatch(creative, /videoUrl|durationSeconds/);
  assert.match(contract, /"IMPRESSION"/);
  assert.match(contract, /"CLICK"/);
  assert.doesNotMatch(contract, /"VIDEO_START"|"VIDEO_COMPLETE"/);
});

test("ad selection request, anonymous context, and event API boundaries stay intact", async () => {
  const [ad, contract, route, eventsRoute, selector] = await Promise.all([
    read("src/components/advertising/sponsored-video-ad.tsx"),
    read("src/contracts/advertising.ts"),
    read("src/app/api/ads/route.ts"),
    read("src/app/api/ads/events/route.ts"),
    read("src/domains/advertising/campaign-selector.ts"),
  ]);

  for (const field of [
    "selectedProviders",
    "companions",
    "moods",
    "desiredGenres",
  ]) {
    assert.match(ad, new RegExp(`choice\\?\\.${field} \\?\\? \\[\\]`));
  }
  assert.match(ad, /void fetch\("\/api\/ads",/);
  assert.match(
    ad,
    /body: JSON\.stringify\(\{[\s\S]*?placement,[\s\S]*?runId,[\s\S]*?context: requestContext \?\? undefined/,
  );
  assert.match(ad, /return result\.campaign/);
  assert.match(ad, /void fetch\("\/api\/ads\/events",/);

  assert.match(contract, /excludes identity, natural-language input, prompts/);
  assert.match(route, /const campaign = selectApprovedCampaign\(\{/);
  assert.match(route, /const response = \{ campaign \} satisfies AdSelectionResponse/);
  assert.match(eventsRoute, /AD_MEASUREMENT_EVENTS\.includes\(event\)/);
  assert.match(selector, /approvalStatus:\s*"APPROVED"/);
  assert.match(selector, /remainingBudgetWon > 0/);
  assert.match(selector, /childSafeRequired/);
  assert.doesNotMatch(
    contract.match(/export interface SponsoredCampaignCreative[\s\S]*?\n\}/)?.[0] ?? "",
    /approvalStatus|remainingBudget|billingModels|targeting/,
  );
});

test("ad selection and measurement routes keep their static creative contract", async () => {
  const [{ POST: selectAd }, { POST: measureAd }] = await Promise.all([
    load("src/app/api/ads/route.ts"),
    load("src/app/api/ads/events/route.ts"),
  ]);
  const selectionResponse = await selectAd(
    new Request("http://localhost/api/ads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        placement: "RESULT",
        context: {
          selectedProviders: ["NETFLIX"],
          companions: ["ALONE"],
          moods: ["따뜻한"],
          desiredGenres: ["코미디"],
        },
      }),
    }),
  );
  assert.equal(selectionResponse.status, 200);
  const selection = await selectionResponse.json();
  assert.ok(selection.campaign);
  assert.equal(typeof selection.campaign.posterUrl, "string");
  assert.equal(typeof selection.campaign.workTitle, "string");
  assert.equal(Object.hasOwn(selection.campaign, "videoUrl"), false);
  assert.equal(Object.hasOwn(selection.campaign, "durationSeconds"), false);

  for (const event of ["IMPRESSION", "CLICK"]) {
    const response = await measureAd(
      new Request("http://localhost/api/ads/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaignId: selection.campaign.id,
          placement: "RESULT",
          event,
        }),
      }),
    );
    assert.equal(response.status, 204);
  }

  const removedVideoEvent = await measureAd(
    new Request("http://localhost/api/ads/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campaignId: selection.campaign.id,
        placement: "RESULT",
        event: "VIDEO_START",
      }),
    }),
  );
  assert.equal(removedVideoEvent.status, 400);
});

test("ad fixtures use fictional calm creatives without former video samples", async () => {
  const selector = await read("src/domains/advertising/campaign-selector.ts");

  assert.doesNotMatch(
    selector,
    /Big Buck Bunny|BigBuckBunny|Sintel|open-movie-big-buck-bunny|open-movie-sintel/i,
  );
  assert.doesNotMatch(
    selector,
    /1분\s*안에|카운트다운|지금\s*결정|서둘러|마감\s*임박/,
  );
  assert.doesNotMatch(selector, /videoUrl|durationSeconds|\.mp4|\/og\.png/);

  const posterUrls = [
    ...selector.matchAll(/posterUrl:\s*"([^"]+)"/g),
  ].map((match) => match[1]);
  assert.ok(posterUrls.length > 0, "ad fixtures must provide static posters");
  for (const posterUrl of posterUrls) {
    if (!posterUrl.startsWith("/")) continue;
    const asset = await read(`public${posterUrl}`);
    assert.doesNotMatch(
      asset,
      /1분\s*안에|카운트다운|지금\s*결정|서둘러|마감\s*임박/,
    );
  }
});

test("loading and empty rail states remain static and stable", async () => {
  const ad = await read("src/components/advertising/sponsored-video-ad.tsx");
  const loading = ad.slice(ad.indexOf("if (loading)"), ad.indexOf("if (!campaign)"));
  const emptyRail = ad.slice(
    ad.indexOf("if (!campaign)"),
    ad.indexOf("const disclaimer"),
  );

  assert.match(loading, /sponsored-ad--loading/);
  assert.match(loading, /sponsored-ad__media-placeholder/);
  assert.match(loading, /sponsored-ad__loading-copy/);
  assert.doesNotMatch(loading, /▶|<video\b|재생/);

  assert.match(emptyRail, /if \(variant !== "rail"\) return null/);
  assert.match(emptyRail, /aria-label="추천 서비스 안내"/);
  assert.match(emptyRail, /href="\/choice"/);
  assert.match(emptyRail, /새 조건 고르기/);
});

test("sponsored card CSS removes controls and follows the organic rail shape", async () => {
  const css = await read("src/app/globals.css");

  for (const videoSelector of [
    /\.sponsored-ad__video-actions/,
    /\.sponsored-ad__playback/,
    /\.sponsored-ad__progress/,
    /\.sponsored-ad__media\s+video/,
  ]) {
    assert.doesNotMatch(css, videoSelector);
  }
  assert.match(css, /\.sponsored-ad__media\s*>?\s*img\s*\{/);
  assert.match(
    css,
    /\.sponsored-ad--rail[\s\S]*?border-radius:\s*16px[\s\S]*?background:\s*#17202a/,
  );
  assert.match(
    css,
    /\.sponsored-ad--rail \.sponsored-ad__media\s*\{[\s\S]*?aspect-ratio:\s*2\s*\/\s*3/,
  );
  assert.match(
    css,
    /\.sponsored-ad--rail\.sponsored-ad--loading\s*\{[\s\S]*?min-height:\s*32rem/,
  );

  const ctaRule = css.match(/\.sponsored-ad__cta\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.ok(ctaRule, "sponsored CTA styling must exist");
  assert.doesNotMatch(
    ctaRule,
    /linear-gradient|box-shadow/,
    "the sponsored CTA must use the same quiet text-action treatment as organic rail cards",
  );

  const responsiveCss = css.slice(css.indexOf("@media (max-width: 1023px)"));
  assert.doesNotMatch(
    responsiveCss,
    /\.sponsored-ad(?:--result)? \.sponsored-ad__media\s*\{[\s\S]*?aspect-ratio:\s*(?:16\s*\/\s*9|16\s*\/\s*10)/,
    "responsive rules must not turn the sponsored poster into a video-shaped frame",
  );
});

test("organic TOP 1, alternatives, and sponsored creative stay in that order", async () => {
  const [choiceResult, naturalResult] = await Promise.all([
    read("src/components/recommendation-view.tsx"),
    read("src/components/natural-recommendation/natural-result.tsx"),
  ]);
  const completed = choiceResult.slice(
    choiceResult.indexOf("export function CompletedView"),
    choiceResult.indexOf("export function RecommendationView"),
  );
  const naturalCompleted = naturalResult.slice(
    naturalResult.indexOf("function CompletedNaturalResults"),
    naturalResult.indexOf("function ResultActions"),
  );

  for (const source of [completed, naturalCompleted]) {
    const topPick = source.indexOf("response.topPick");
    const alternatives = source.indexOf("alternatives.map", topPick);
    const sponsored = source.indexOf('placement="RESULT"', alternatives);
    assert.ok(topPick >= 0, "TOP 1 must render");
    assert.ok(alternatives > topPick, "alternatives must follow TOP 1");
    assert.ok(sponsored > alternatives, "sponsored creative must end the rail");
    assert.match(source.slice(alternatives, sponsored), /rail/);
    assert.match(source.slice(sponsored), /variant="rail"/);
    assert.match(source, /md:grid-cols-2/);
    assert.match(source, /lg:grid-cols-3/);
    assert.match(source, /xl:grid-cols-5/);
  }
});

test("waiting creative uses the real request window without delaying results", async () => {
  const [waiting, choice, naturalFlow] = await Promise.all([
    read("src/components/advertising/recommendation-waiting-screen.tsx"),
    read("src/components/choice-stepper/choice-stepper.tsx"),
    read("src/components/natural-recommendation/natural-recommendation-flow.tsx"),
  ]);

  for (const step of ["조건 확인", "작품 비교", "최종 추천 선택"]) {
    assert.match(waiting, new RegExp(step));
  }
  assert.match(waiting, /placement="WAITING"/);
  assert.match(choice, /if \(isSubmitting\)[\s\S]*?<RecommendationWaitingScreen/);
  assert.match(naturalFlow, /const outcome = await requestOutcome/);
  assert.doesNotMatch(naturalFlow, /await wait|wait\(1_100\)|허위 카운트다운/);
});
