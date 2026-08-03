import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const rootPath = path.resolve(import.meta.dirname, "..");
const landingFiles = [
  "landing-page.tsx",
  "landing-nav.tsx",
  "landing-hero.tsx",
  "recommendation-showcase.tsx",
  "supported-provider-strip.tsx",
  "landing-features.tsx",
  "landing-footer.tsx",
  "landing-data.ts",
  // 다른 검사들이 이 배열을 순서대로 구조분해한다. 새 파일은 뒤에만 붙인다.
  "landing-auth.tsx",
];

async function read(relativePath) {
  return readFile(path.resolve(rootPath, relativePath), "utf8");
}

async function readLandingSources() {
  return Promise.all(
    landingFiles.map((file) => read(`src/components/landing/${file}`)),
  );
}

test("landing page is split into focused production components", async () => {
  for (const file of landingFiles) {
    assert.ok(
      existsSync(path.resolve(rootPath, "src/components/landing", file)),
      `${file} must exist`,
    );
  }

  const page = await read("src/app/page.tsx");
  const composition = await read("src/components/landing/landing-page.tsx");
  assert.match(page, /<LandingPage\s*\/>/);
  assert.doesNotMatch(page, /<(?:nav|section|footer)\b/);
  for (const component of [
    "LandingNav",
    "LandingHero",
    "RecommendationShowcase",
    "LandingFeatures",
    "LandingFooter",
  ]) {
    assert.ok(composition.includes(component), `${component} must be composed`);
  }
  assert.ok(
    !composition.includes("SupportedProviderStrip"),
    "provider guidance must live inside the hero instead of a separate strip",
  );
});

test("hero exposes separate active condition and prompt CTAs", async () => {
  const sources = await readLandingSources();
  const all = sources.join("\n");
  const hero = sources[2];

  assert.match(hero, /href="\/choice"[\s\S]*data-cta="primary"/);
  assert.match(
    hero,
    /data-cta="primary"[\s\S]*from-\[#ff5430\][\s\S]*to-\[#ff7c42\]/,
  );
  assert.match(hero, /조건 골라 추천받기/);
  assert.match(hero, /href="\/prompt"[\s\S]*data-cta="secondary"/);
  assert.match(hero, /data-cta="secondary"[\s\S]*bg-\[#17202a\]/);
  assert.match(hero, /문장으로 추천받기/);
  assert.match(hero, /Beta/);
  assert.doesNotMatch(hero, /disabled|준비 중/);
  assert.doesNotMatch(all, /fetch\(|useState|useRouter/);
});

test("landing keeps one three-card preview without a duplicate poster rail", async () => {
  const sources = await readLandingSources();
  const all = sources.join("\n");
  const hero = sources[2];
  const showcase = sources[3];
  const data = sources[7];

  assert.match(hero, /HERO_POSTERS\.map/);
  assert.match(showcase, /PREVIEW_POSTERS\.map/);
  assert.doesNotMatch(
    showcase,
    /LANDING_POSTERS|slice\(1,\s*7\)|grid-cols-6|min-w-\[56rem\]|cinema-showcase__rail/,
  );
  assert.match(data, /image\.tmdb\.org/);
  assert.equal(
    [...data.matchAll(/id:\s*"(?:midnight|modern|brooklyn|the-bear|moving|anne|hospital|reply|little|extreme)/g)].length,
    10,
  );
  const previewDefinition = data.match(
    /export const PREVIEW_POSTERS = \[[\s\S]*?\] as const;/,
  )?.[0];
  assert.ok(previewDefinition, "the three-card preview must be defined");
  assert.equal(
    [...previewDefinition.matchAll(/LANDING_POSTERS\[\d+\]/g)].length,
    3,
  );
  assert.match(showcase, /role="img"/);
  assert.match(showcase, /aria-label=\{`\$\{poster\.title\} 포스터`\}/);
  assert.match(showcase, /overflow-x-auto/);
  assert.match(showcase, /snap-x/);
  assert.doesNotMatch(all, /placehold\.co|unsplash\.com/);
});

test("landing copy matches the actual Choice flow and user perspective", async () => {
  const sources = await readLandingSources();
  const all = sources.join("\n");
  const hero = sources[2];
  const features = sources[5];
  const data = sources[7];

  assert.match(
    hero,
    /누구와 볼지,\s*가능한 시간과 이용할 OTT를 고르면 지금 보기 좋은\s*작품을 이유와 함께 추천해드려요\./,
  );
  assert.match(features, /고른 조건을 지키면서 추천해요\./);
  assert.match(
    features,
    /시청 가능한 시간과 OTT를 먼저 확인하고, 원하는 느낌과 취향에\s*맞는 작품을 골라드려요\./,
  );
  for (const title of [
    "지금 볼 수 있는 작품부터",
    "조건을 바꾸기 전에 먼저 확인",
    "비교하기 좋은 수로 정리",
    "왜 골랐는지 한눈에",
  ]) {
    assert.match(data, new RegExp(title));
  }
  for (const oldCopy of [
    "추천 결과보다 과정을 먼저 설계했어요.",
    "취향보다 지금 상황부터",
    "조건을 몰래 바꾸지 않기",
    "고르기 좋은 수로 좁히기",
    "추천 이유까지 투명하게",
    "누구와, 어떤 기분으로, 얼마나 볼지만 알려주세요.",
  ]) {
    assert.ok(!all.includes(oldCopy), `superseded copy must be removed: ${oldCopy}`);
  }
});

test("landing exposes recommendation actions and wired account controls", async () => {
  const all = (await readLandingSources()).join("\n");
  const auth = await read("src/components/landing/landing-auth.tsx");

  // 로그인과 찜 목록은 실제로 동작하므로 연결한다. 프로필·시청기록·커뮤니티는
  // 여전히 이 제품의 범위 밖이라 링크가 생기면 안 된다.
  assert.doesNotMatch(
    all,
    /href=["']\/(?:signup|profile|my|watched|community)/i,
  );
  assert.doesNotMatch(all, /CREATE ACCOUNT|무료로 가입|커뮤니티/i);
  assert.doesNotMatch(all, /href=["']#["']/);
  assert.match(all, /href="\/choice"/);
  assert.match(all, /href="\/prompt"/);

  assert.match(auth, />\s*회원가입\s*</);
  assert.match(auth, />\s*로그인\s*</);
  assert.match(auth, /href="\/login"/);
  assert.match(
    auth,
    /href="\/login\?mode=signup"/,
    "회원가입으로 들어온 사람에게 로그인 칸을 먼저 보이면 한 번 더 눌러야 한다",
  );
  assert.match(auth, /href="\/watchlist"/);

  // 준비 중 자리표시자는 남아 있으면 안 된다. 실제로 되는 기능을 안 되는 것처럼
  // 보여주는 셈이다.
  assert.equal(
    [...all.matchAll(/<button\b[\s\S]*?\bdisabled\b[\s\S]*?<\/button>/g)].length,
    0,
  );
  assert.doesNotMatch(all, /준비 중/);

  // 로그인 여부를 확인하기 전에는 어느 쪽도 단정하지 않는다.
  assert.match(auth, /loading/);
  assert.doesNotMatch(all, /익명 추천 서비스|계정 없이/);
});

test("hero uses a smaller poster hierarchy and keeps OTT guidance below independent CTAs", async () => {
  const hero = await read("src/components/landing/landing-hero.tsx");
  const composition = await read("src/components/landing/landing-page.tsx");

  assert.match(hero, /aspect-\[2\/3\]/);
  assert.match(hero, /bg-cover/);
  assert.match(hero, /bg-no-repeat/);
  assert.doesNotMatch(hero, /bg-contain|rotate-\[-2deg\]|border-white\/15 bg-\[#18212b\]\/90 p-2/);
  assert.match(hero, /h-\[32rem\][\s\S]*max-w-\[28rem\]/);
  assert.equal([...hero.matchAll(/data-poster-emphasis=/g)].length, 1);
  assert.match(hero, /index === 0 \? "main" : "supporting"/);
  assert.equal(
    [...hero.matchAll(/^\s*"(?:left|right|bottom)/gm)].length,
    6,
  );
  assert.match(
    hero,
    /문장으로 추천받기[\s\S]*이용 중인 OTT를 선택하면, 그 안에서 볼 수 있는 작품만 추천해요\./,
  );
  assert.match(hero, /SUPPORTED_PROVIDERS\.join\(" · "\)/);
  assert.match(hero, /지금 상황 반영 · 추천 이유 제공/);
  assert.doesNotMatch(hero, /OTT 조건 반영|추천 이유 공개|고르는 시간은 짧게/);
  assert.doesNotMatch(composition, /SupportedProviderStrip/);
});

test("landing keeps semantic and responsive contracts", async () => {
  const sources = await readLandingSources();
  const all = sources.join("\n");

  assert.equal([...all.matchAll(/<h1\b/g)].length, 1);
  assert.match(all, /<nav\b/);
  assert.match(all, /<main\b/);
  assert.match(all, /<footer\b/);
  assert.match(all, /<section[\s\S]*aria-labelledby=/);
  assert.match(all, /flex-wrap/);
  assert.match(all, /sm:grid-cols-2/);
  assert.match(all, /sm:grid-cols-3/);
  assert.match(all, /lg:grid-cols-/);
  assert.match(all, /overflow-x-auto/);
  assert.match(all, /focus-visible:outline/);
});
