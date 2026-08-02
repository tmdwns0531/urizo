import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const rootPath = path.resolve(import.meta.dirname, "..");
const moduleCache = new Map();

function resolveTypeScriptModule(fromPath, specifier) {
  const base = path.resolve(path.dirname(fromPath), specifier);
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Cannot resolve ${specifier} from ${fromPath}`);
}

async function moduleDataUrl(filePath) {
  const absolutePath = path.resolve(rootPath, filePath);
  if (moduleCache.has(absolutePath)) return moduleCache.get(absolutePath);

  const pending = (async () => {
    const source = await readFile(absolutePath, "utf8");
    let output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: absolutePath,
    }).outputText;
    const matches = [...output.matchAll(/(?:from\s+|import\s+)(["'])(\.[^"']+)\1/g)];
    for (const match of matches.reverse()) {
      const specifier = match[2];
      const specifierOffset = match[0].lastIndexOf(specifier);
      const start = match.index + specifierOffset;
      const dependency = resolveTypeScriptModule(absolutePath, specifier);
      const dependencyUrl = await moduleDataUrl(dependency);
      output =
        output.slice(0, start) +
        dependencyUrl +
        output.slice(start + specifier.length);
    }
    return `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`;
  })();
  moduleCache.set(absolutePath, pending);
  return pending;
}

async function loadModule(filePath) {
  return import(await moduleDataUrl(filePath));
}

function readSource(filePath) {
  return readFile(path.resolve(rootPath, filePath), "utf8");
}

function content(overrides = {}) {
  return {
    id: "content-1",
    tmdbId: 1,
    title: "조용한 밤",
    synopsis: "평범한 이야기",
    mediaType: "MOVIE",
    runtimeMinutes: 100,
    releaseYear: 2026,
    genres: [],
    moodTags: [],
    companionTags: [],
    ageRating: "15",
    originCountries: ["KR"],
    productionCountries: ["KR"],
    providers: [
      {
        provider: "NETFLIX",
        watchUrl: "https://example.test/watch",
        linkType: "DIRECT",
      },
    ],
    collectionId: null,
    voteAverage: 8,
    voteCount: 100,
    posterUrl: null,
    backdropColor: "#000000",
    ...overrides,
  };
}

// SEARCH-01
test("반전 joins the tension semantic group and reaches thriller content", async () => {
  const semantic = await loadModule("src/domains/search/semantic.ts");

  const tokens = semantic.tokenize("반전");
  for (const sibling of ["긴장", "긴장감", "스릴러", "미스터리", "추리", "몰입"]) {
    assert.ok(
      tokens.includes(sibling),
      `"반전" must expand to the tension group member "${sibling}"`,
    );
  }

  // The expansion is symmetric: existing members must reach 반전 too.
  assert.ok(semantic.tokenize("스릴러").includes("반전"));

  const thriller = content({
    title: "미스터리 극장",
    synopsis: "끝까지 긴장감이 이어지는 추리 이야기",
    genres: ["스릴러"],
    moodTags: ["긴장감 있는"],
  });
  const unrelated = content({
    title: "밝은 하루",
    synopsis: "가볍고 유쾌한 코미디",
    genres: ["코미디"],
    moodTags: ["밝은"],
  });

  const thrillerScore = semantic.semanticSimilarity("반전", thriller).score;
  const unrelatedScore = semantic.semanticSimilarity("반전", unrelated).score;
  assert.ok(
    thrillerScore > unrelatedScore,
    `반전 must favour thriller content (${thrillerScore} vs ${unrelatedScore})`,
  );
  assert.ok(thrillerScore > 0, "반전 must not score zero against thriller content");
});

test("반전 does not leak into unrelated semantic groups", async () => {
  const semantic = await loadModule("src/domains/search/semantic.ts");
  const tokens = semantic.tokenize("반전");
  for (const foreign of ["코미디", "위로", "로맨스", "가족", "액션", "음악"]) {
    assert.ok(
      !tokens.includes(foreign),
      `"반전" must not expand to the unrelated term "${foreign}"`,
    );
  }
});

// UX-02 backing behaviour
test("natural language is combined with chips instead of replacing them", async () => {
  const query = await loadModule("src/domains/search/query.ts");
  const sentence = query.buildMvpSearchQuery({
    companions: ["ALONE"],
    moods: ["긴장감 있는"],
    desiredGenres: [],
    maxRuntimeMinutes: 120,
    originPreference: "KR",
    naturalLanguage: "반전 있는 영화",
  });

  assert.ok(sentence.includes("반전 있는 영화"), "natural language must survive");
  assert.ok(sentence.includes("혼자"), "companion chip must survive");
  assert.ok(sentence.includes("긴장감"), "mood chip must survive");
  assert.ok(sentence.includes("120분"), "runtime chip must survive");
  assert.ok(sentence.includes("한국 작품"), "origin chip must survive");
});

test("natural language source text never enters the sanitized search input", async () => {
  const request = await loadModule("src/domains/recommendation/request.ts");
  const resolved = request.resolveMvpRecommendationRequest({
    choice: { naturalLanguage: "반전 있는 영화", moods: ["긴장감 있는"] },
  });
  const transient = request.toMvpSearchInput(resolved);
  const sanitized = request.sanitizeMvpSearchInput(transient);

  assert.equal(sanitized.hasNaturalLanguage, true);
  assert.ok(
    !JSON.stringify(sanitized).includes("반전 있는 영화"),
    "sanitized input must carry only the hasNaturalLanguage flag",
  );
});

// UX-01
test("CHOICE renders a real state-driven progress stepper", async () => {
  const page = await readSource("src/app/choice/page.tsx");
  const entry = await readSource("src/components/choice-form.tsx");
  const stepper = await readSource(
    "src/components/choice-stepper/choice-stepper.tsx",
  );
  const progress = await readSource(
    "src/components/choice-stepper/progress-bar.tsx",
  );

  assert.ok(page.includes("<ChoiceForm"), "route must render the CHOICE entry");
  assert.ok(entry.includes("<ChoiceStepper"), "entry must render the stepper");
  assert.ok(
    stepper.includes("useState<ChoiceStep>(") &&
      stepper.includes("initialHandoff ? 6 : 1"),
    "stepper must own currentStep and honor a one-time structured handoff",
  );
  assert.ok(
    stepper.includes("<ProgressBar currentStep={currentStep}"),
    "progress must follow the current step instead of a hardcoded active item",
  );
  assert.ok(
    progress.includes('role="progressbar"'),
    "progress must expose progressbar semantics",
  );
  assert.ok(
    progress.includes("aria-valuenow={currentStep}"),
    "announced progress must follow currentStep",
  );
});

// UX-02
test("CHOICE summary contains only the structured step selections", async () => {
  const summary = await readSource(
    "src/components/choice-stepper/step-6-summary.tsx",
  );
  const state = await readSource(
    "src/components/choice-stepper/choice-state.ts",
  );
  for (const field of [
    "누구와",
    "시청 시간",
    "이용 OTT",
    "원하는 느낌",
    "취향 더하기",
    "제작 지역",
    "선호 장르",
  ]) {
    assert.ok(summary.includes(field), `summary must show ${field}`);
  }
  for (const removed of ["추가 요청", "피하는 장르", "시연 흐름"]) {
    assert.ok(!summary.includes(removed), `${removed} must be removed`);
  }
  assert.ok(!state.includes("naturalLanguage"));
  assert.ok(!state.includes("scenario"));
});

test("child rating copy matches the maximum allowed rating filter", async () => {
  const [stepOne, summary, canonical, naturalAge, naturalLanguage, naturalResult] =
    await Promise.all([
      readSource("src/components/choice-stepper/step-1-who.tsx"),
      readSource("src/components/choice-stepper/step-6-summary.tsx"),
      readSource("src/components/recommendation-view.tsx"),
      readSource("src/components/natural-recommendation/natural-age-step.tsx"),
      readSource("src/components/natural-recommendation/natural-language.ts"),
      readSource("src/components/natural-recommendation/natural-result.tsx"),
    ]);

  assert.ok(stepOne.includes("선택한 관람 등급을 최대 허용 기준으로 결과 필터에 직접"));
  assert.ok(summary.includes("최대 허용 관람등급:"));
  assert.ok(canonical.includes("고른 관람 등급을 최대 허용 기준으로 결과 필터에"));
  assert.ok(canonical.includes("선택한 최대 허용 관람등급을 포함한 모든 조건으로"));
  assert.ok(naturalAge.includes("선택한 관람 등급을 최대 허용"));
  assert.ok(naturalLanguage.includes("최대 허용 관람등급으로 결과 필터에 적용했어요"));
  assert.ok(naturalResult.includes("가족 구성을 확인한 뒤, 아이 동반이면 고른 관람 등급을"));
  assert.ok(naturalResult.includes("결과 필터에 적용했고, 직접 말한 조건과 기본값을"));
  assert.ok(naturalResult.includes("선택한 최대 허용 관람등급을 포함한 모든 조건으로"));

  const allCopy = [stepOne, summary, naturalAge, naturalLanguage].join("\n");
  for (const staleCopy of [
    "결과 필터에 직접 반영하지",
    "현재 결과 필터에 직접 반영되지",
    "아이 동반 공통 기준",
    "공통 안전 기준",
  ]) {
    assert.ok(!allCopy.includes(staleCopy), `stale child-rating copy remains: ${staleCopy}`);
  }
});

test("approval copy does not promise a fixed result count", async () => {
  const source = await readSource("src/components/recommendation-view.tsx");
  assert.ok(!source.includes("5편 예상"), "approval must not promise five results");
  assert.ok(
    source.includes("response.proposal.currentMaxMinutes"),
    "approval must render the current runtime from the proposal",
  );
  assert.ok(
    source.includes("response.proposal.proposedMaxMinutes"),
    "approval must render the proposed runtime from the proposal",
  );
});

test("canonical result renders and submits every family clarification answer", async () => {
  const source = await readSource("src/components/recommendation-view.tsx");
  assert.ok(
    source.includes("response.proposal.answers.map"),
    "family clarification must render its answer list",
  );
  assert.ok(
    source.includes("onClarification(answer.value)"),
    "each family answer must remain actionable",
  );
  assert.match(
    source,
    /body:\s*JSON\.stringify\(\{\s*answer\s*\}\)/,
    "canonical result must submit the clarification answer",
  );
});

test("mobile recommendation action submits the active CHOICE form", async () => {
  const form = await readSource(
    "src/components/choice-stepper/choice-stepper.tsx",
  );
  const navigation = await readSource(
    "src/components/choice-stepper/step-navigation.tsx",
  );
  const resultsPage = await readSource(
    "src/app/recommendations/[runId]/page.tsx",
  );
  const css = await readSource("src/app/globals.css");

  assert.ok(form.includes('id="choice-form"'), "CHOICE form must have a stable id");
  assert.ok(form.includes("onSubmit="), "CHOICE form must handle semantic submit");
  assert.ok(
    navigation.includes('type="submit"'),
    "summary action must submit the active CHOICE form",
  );
  assert.ok(
    navigation.includes("추천 시작하기"),
    "summary action must use the final recommendation label",
  );
  assert.ok(
    navigation.includes("currentStep === 6"),
    "submit action must only replace navigation on the summary step",
  );
  assert.ok(
    resultsPage.includes('active="results"'),
    "results must render the new-recommendation action",
  );
  const actionRule = css.match(/\.choice-stepper-actions\s*\{([^}]*)\}/s)?.[1];
  assert.ok(actionRule, "stepper action styling must exist");
  assert.match(
    actionRule,
    /position:\s*fixed/,
    "stepper actions must remain reachable at the viewport bottom",
  );
});

test("starting a new recommendation warns before discarding a CHOICE draft", async () => {
  const form = await readSource(
    "src/components/choice-stepper/choice-stepper.tsx",
  );
  const navigation = await readSource(
    "src/components/choice-stepper/choice-nav.tsx",
  );

  assert.ok(
    form.includes("data-choice-dirty="),
    "CHOICE must expose whether the user has entered conditions",
  );
  assert.ok(
    navigation.includes("입력한 조건이 초기화됩니다"),
    "leaving or restarting CHOICE must explain the reset",
  );
  assert.ok(
    navigation.includes("window.confirm("),
    "leaving or restarting a dirty draft must ask for confirmation",
  );
});

test("fully neutral recommendations are blocked in both UI and orchestration", async () => {
  const state = await readSource(
    "src/components/choice-stepper/choice-state.ts",
  );
  const ottStep = await readSource(
    "src/components/choice-stepper/step-3-ott.tsx",
  );
  const orchestrator = await readSource(
    "src/domains/recommendation/orchestrator.ts",
  );

  assert.ok(
    state.includes("state.otts.length > 0"),
    "CHOICE must require a meaningful OTT selection before summary",
  );
  assert.ok(
    ottStep.includes("최소 1개 이상 선택"),
    "CHOICE must explain the mandatory OTT condition",
  );
  assert.ok(
    orchestrator.includes("requireMeaningfulChoice: true"),
    "server orchestration must enforce the same policy",
  );
});

// UX-03
test("CHOICE and landing copy carry no developer-facing terminology", async () => {
  const banned = [
    "Preview",
    "DEMO LAB",
    "Demo는 키 없이 실행",
    "LIVE는 선택 기능만 연결",
    "핵심 정책 시나리오",
    "승인 게이트",
    "정책 차단",
    "예산 폴백",
    "정책 확인 완료",
    "필수 필터",
    "실행기",
    "칩 선택만으로도",
  ];
  for (const file of [
    "src/app/page.tsx",
    "src/app/choice/page.tsx",
    "src/components/choice-form.tsx",
    "src/components/choice-stepper/choice-nav.tsx",
    "src/components/choice-stepper/choice-options.ts",
    "src/components/choice-stepper/choice-stepper.tsx",
    "src/components/choice-stepper/progress-bar.tsx",
    "src/components/choice-stepper/step-1-who.tsx",
    "src/components/choice-stepper/step-2-time.tsx",
    "src/components/choice-stepper/step-3-ott.tsx",
    "src/components/choice-stepper/step-4-mood.tsx",
    "src/components/choice-stepper/step-5-extra.tsx",
    "src/components/choice-stepper/step-6-summary.tsx",
    "src/components/choice-stepper/step-navigation.tsx",
    "src/components/landing/landing-page.tsx",
    "src/components/landing/landing-nav.tsx",
    "src/components/landing/landing-hero.tsx",
    "src/components/landing/recommendation-showcase.tsx",
    "src/components/landing/supported-provider-strip.tsx",
    "src/components/landing/landing-features.tsx",
    "src/components/landing/landing-footer.tsx",
    "src/components/landing/landing-data.ts",
  ]) {
    const source = await readSource(file);
    for (const term of banned) {
      assert.ok(
        !source.includes(term),
        `${file} must not expose the developer-facing term "${term}"`,
      );
    }
  }

  const extraStep = await readSource(
    "src/components/choice-stepper/step-5-extra.tsx",
  );
  assert.ok(!extraStep.includes("시연 모드"));
  assert.ok(!extraStep.includes("SCENARIO_OPTIONS"));
  assert.ok(!extraStep.includes("추가 요청 및 시연 설정"));
});
