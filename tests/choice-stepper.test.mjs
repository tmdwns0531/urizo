import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const rootPath = path.resolve(import.meta.dirname, "..");
const moduleCache = new Map();

function readSource(filePath) {
  return readFile(path.resolve(rootPath, filePath), "utf8");
}

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

test("CHOICE is split into navigation, progress, six steps, and step actions", async () => {
  const components = [
    ["choice-nav.tsx", "ChoiceNav"],
    ["progress-bar.tsx", "ProgressBar"],
    ["step-1-who.tsx", "Step1Who"],
    ["step-2-time.tsx", "Step2Time"],
    ["step-3-ott.tsx", "Step3Ott"],
    ["step-4-mood.tsx", "Step4Mood"],
    ["step-5-extra.tsx", "Step5Extra"],
    ["step-6-summary.tsx", "Step6Summary"],
    ["step-navigation.tsx", "StepNavigation"],
  ];
  const parent = await readSource(
    "src/components/choice-stepper/choice-stepper.tsx",
  );

  for (const [fileName, exportName] of components) {
    const relativePath = `src/components/choice-stepper/${fileName}`;
    assert.equal(existsSync(path.resolve(rootPath, relativePath)), true);
    const source = await readSource(relativePath);
    assert.match(
      source,
      new RegExp(`export function ${exportName}\\b`),
      `${exportName} must remain an independently maintained component`,
    );
    assert.ok(
      parent.includes(`<${exportName}`),
      `ChoiceStepper must compose ${exportName}`,
    );
  }
});

test("required steps distinguish unanswered values from explicit neutral answers", async () => {
  const choice = await loadModule(
    "src/components/choice-stepper/choice-state.ts",
  );
  const initial = choice.INITIAL_CHOICE_STATE;

  assert.deepEqual(
    Object.fromEntries(
      [
        "who",
        "familyType",
        "childAge",
        "duration",
        "otts",
        "mood",
        "origin",
        "genres",
      ].map((key) => [key, initial[key]]),
    ),
    {
      who: null,
      familyType: null,
      childAge: null,
      duration: undefined,
      otts: [],
      mood: null,
      origin: null,
      genres: [],
    },
  );
  assert.equal(choice.canAdvanceChoiceStep(1, initial), false);
  assert.equal(choice.canAdvanceChoiceStep(2, initial), false);
  assert.equal(choice.canAdvanceChoiceStep(3, initial), false);
  assert.equal(choice.canAdvanceChoiceStep(4, initial), false);
  assert.equal(
    choice.canAdvanceChoiceStep(5, initial),
    true,
    "the additional-condition step must be optional",
  );

  const neutralDuration = choice.choiceReducer(initial, {
    type: "SET_DURATION",
    value: null,
  });
  assert.equal(
    choice.canAdvanceChoiceStep(2, neutralDuration),
    true,
    "an explicit '상관없음' answer must be accepted",
  );
});

test("FAMILY requires its branch details and derives the exact API companion", async () => {
  const choice = await loadModule(
    "src/components/choice-stepper/choice-state.ts",
  );
  let state = choice.choiceReducer(choice.INITIAL_CHOICE_STATE, {
    type: "SET_WHO",
    value: "FAMILY",
  });

  assert.equal(choice.canAdvanceChoiceStep(1, state), false);
  assert.equal(
    choice.getChoiceStepError(1, state),
    "함께 볼 가족 구성원을 선택해 주세요.",
  );

  state = choice.choiceReducer(state, {
    type: "SET_FAMILY_TYPE",
    value: "KIDS",
  });
  assert.equal(choice.canAdvanceChoiceStep(1, state), false);
  assert.equal(
    choice.getChoiceStepError(1, state),
    "아이와 볼 수 있는 관람 등급을 선택해 주세요.",
  );

  state = choice.choiceReducer(state, {
    type: "SET_CHILD_AGE",
    value: "AGE_12",
  });
  assert.equal(choice.canAdvanceChoiceStep(1, state), true);
  assert.equal(choice.resolveCompanionChoice(state), "WITH_CHILDREN");
  assert.deepEqual(
    choice.buildRecommendationRequest(state, false).choice.companions,
    ["WITH_CHILDREN"],
  );
  assert.equal(
    choice.buildRecommendationRequest(state, false).choice
      .childAgeRatingLimit,
    "12",
  );

  state = choice.choiceReducer(state, {
    type: "SET_FAMILY_TYPE",
    value: "ADULTS",
  });
  assert.equal(state.childAge, null, "the adults branch must clear child age");
  assert.equal(choice.canAdvanceChoiceStep(1, state), true);
  assert.equal(choice.resolveCompanionChoice(state), "FAMILY");
  assert.deepEqual(
    choice.buildRecommendationRequest(state, false).choice.companions,
    ["FAMILY"],
  );

  state = choice.choiceReducer(state, {
    type: "SET_FAMILY_TYPE",
    value: "KIDS",
  });
  state = choice.choiceReducer(state, {
    type: "SET_CHILD_AGE",
    value: "AGE_7",
  });
  state = choice.choiceReducer(state, { type: "SET_WHO", value: "ANY" });
  assert.equal(state.familyType, null);
  assert.equal(state.childAge, null);
  assert.equal(
    choice.canAdvanceChoiceStep(1, state),
    true,
    "independent ANY must be a valid explicit answer",
  );
  assert.equal(choice.resolveCompanionChoice(state), "ANY");
  assert.deepEqual(
    choice.buildRecommendationRequest(state, false).choice.companions,
    ["ANY"],
  );
});

test("Step 3 needs one OTT and Step 4 keeps one scalar mood", async () => {
  const choice = await loadModule(
    "src/components/choice-stepper/choice-state.ts",
  );
  let state = choice.INITIAL_CHOICE_STATE;

  assert.equal(choice.canAdvanceChoiceStep(3, state), false);
  state = choice.choiceReducer(state, {
    type: "TOGGLE_OTT",
    value: "NETFLIX",
  });
  assert.deepEqual(state.otts, ["NETFLIX"]);
  assert.equal(choice.canAdvanceChoiceStep(3, state), true);

  state = choice.choiceReducer(state, {
    type: "TOGGLE_OTT",
    value: "NETFLIX",
  });
  assert.deepEqual(state.otts, []);
  assert.equal(choice.canAdvanceChoiceStep(3, state), false);

  assert.equal(choice.canAdvanceChoiceStep(4, state), false);
  state = choice.choiceReducer(state, { type: "SET_MOOD", value: "밝은" });
  assert.equal(state.mood, "밝은");
  assert.equal(choice.canAdvanceChoiceStep(4, state), true);
  state = choice.choiceReducer(state, { type: "SET_MOOD", value: "ANY" });
  assert.equal(state.mood, "ANY", "a new mood answer must replace the old one");

  const moodStep = await readSource(
    "src/components/choice-stepper/step-4-mood.tsx",
  );
  assert.ok(moodStep.includes('type="radio"'));
  assert.ok(moodStep.includes('name="mood"'));
});

test("Step 5 keeps only optional origin and genre preferences", async () => {
  const extra = await readSource(
    "src/components/choice-stepper/step-5-extra.tsx",
  );
  const summary = await readSource(
    "src/components/choice-stepper/step-6-summary.tsx",
  );
  const parent = await readSource(
    "src/components/choice-stepper/choice-stepper.tsx",
  );

  assert.ok(extra.includes("ORIGIN_OPTIONS.map"));
  assert.ok(extra.includes("GENRE_OPTIONS.map"));
  assert.ok(extra.includes("아무것도"), "step 5 must explain that it is optional");
  for (const removed of [
    "추가 요청 및 시연 설정",
    "choice-extra-panel",
    "choice-natural-language",
    "choice-avoid-genre",
    "SCENARIO_OPTIONS",
  ]) {
    assert.ok(!extra.includes(removed), `${removed} must be removed from Step 5`);
  }

  assert.ok(summary.includes("onClick={() => onEdit(step)}"));
  assert.ok(parent.includes("function editStep(step: ChoiceStep)"));
  assert.ok(
    parent.includes("setCurrentStep(step)"),
    "each summary edit action must jump directly to its owning step",
  );
  assert.ok(
    parent.includes("setReturnToSummary(true)"),
    "finishing an edit must be able to return to the summary",
  );
});

test("genre selection caps at two, permits deselection, and blocks a third", async () => {
  const choice = await loadModule(
    "src/components/choice-stepper/choice-state.ts",
  );
  let state = choice.INITIAL_CHOICE_STATE;

  state = choice.choiceReducer(state, {
    type: "TOGGLE_GENRE",
    value: "SF/판타지",
  });
  state = choice.choiceReducer(state, {
    type: "TOGGLE_GENRE",
    value: "공포/스릴러",
  });
  assert.deepEqual(state.genres, ["SF/판타지", "공포/스릴러"]);

  const cappedState = state;
  state = choice.choiceReducer(state, {
    type: "TOGGLE_GENRE",
    value: "액션",
  });
  assert.strictEqual(state, cappedState, "a third genre must be blocked");

  state = choice.choiceReducer(state, {
    type: "TOGGLE_GENRE",
    value: "SF/판타지",
  });
  assert.deepEqual(state.genres, ["공포/스릴러"]);
  state = choice.choiceReducer(state, {
    type: "TOGGLE_GENRE",
    value: "액션",
  });
  assert.deepEqual(state.genres, ["공포/스릴러", "액션"]);

  const extra = await readSource(
    "src/components/choice-stepper/step-5-extra.tsx",
  );
  assert.ok(extra.includes("state.genres.length >= 2 && !isSelected"));
  assert.ok(extra.includes("aria-disabled={isBlocked}"));
  assert.ok(extra.includes("if (!isBlocked) onToggleGenre(option.value)"));
});

test("progress and final navigation are driven by currentStep with fixed actions", async () => {
  const progress = await readSource(
    "src/components/choice-stepper/progress-bar.tsx",
  );
  const navigation = await readSource(
    "src/components/choice-stepper/step-navigation.tsx",
  );
  const css = await readSource("src/app/globals.css");

  assert.ok(progress.includes('role="progressbar"'));
  assert.ok(progress.includes("aria-valuemin={1}"));
  assert.ok(progress.includes("aria-valuemax={6}"));
  assert.ok(progress.includes("aria-valuenow={currentStep}"));
  assert.ok(progress.includes("STEP_LABELS[currentStep - 1]"));

  assert.ok(navigation.includes("currentStep > 1"));
  assert.ok(navigation.includes("currentStep === 6"));
  assert.ok(navigation.includes('type="submit"'));
  assert.ok(navigation.includes("추천 시작하기"));

  const actionRule = css.match(/\.choice-stepper-actions\s*\{([^}]*)\}/s)?.[1];
  assert.ok(actionRule, "fixed action rule must exist");
  assert.match(actionRule, /position:\s*fixed/);
  assert.match(actionRule, /bottom:\s*0/);
  assert.match(actionRule, /left:\s*0/);
  assert.match(actionRule, /right:\s*0/);
});

test("the strict recommendation payload maps form state and omits unsupported childAge", async () => {
  const choice = await loadModule(
    "src/components/choice-stepper/choice-state.ts",
  );
  const state = {
    ...choice.INITIAL_CHOICE_STATE,
    who: "FAMILY",
    familyType: "KIDS",
    childAge: "AGE_15",
    duration: 120,
    otts: ["NETFLIX", "TVING"],
    mood: "긴장감 있는",
    origin: "KR",
    genres: ["SF/판타지", "공포/스릴러"],
  };

  const request = choice.buildRecommendationRequest(state);
  assert.deepEqual(choice.buildChoiceDraftPayload(state), {
    who: "FAMILY",
    familyType: "KIDS",
    childAge: "AGE_15",
    duration: 120,
    otts: ["NETFLIX", "TVING"],
    mood: "긴장감 있는",
    origin: "KR",
    mediaType: null,
    genres: ["SF/판타지", "공포/스릴러"],
  });
  assert.deepEqual(request, {
    choice: {
      selectedProviders: ["NETFLIX", "TVING"],
      companions: ["WITH_CHILDREN"],
      moods: ["긴장감 있는"],
      maxRuntimeMinutes: 120,
      childAgeRatingLimit: "15",
      originPreference: "KR",
      mediaType: "ANY",
      desiredGenres: ["SF", "판타지", "공포", "스릴러"],
      explicitlyRequestedGenres: ["SF", "판타지", "공포", "스릴러"],
      companionAvoidGenres: [],
    },
  });
  assert.equal(
    Object.hasOwn(request.choice, "childAge"),
    false,
    "unknown childAge must not be sent to the strict public DTO",
  );
  assert.equal(
    Object.hasOwn(request.choice, "familyType"),
    false,
    "route-only familyType must not be sent to the strict public DTO",
  );
  assert.ok(!JSON.stringify(request).includes("AGE_15"));
  assert.ok(!JSON.stringify(request).includes("KIDS"));
  assert.deepEqual(
    request.choice.desiredGenres,
    request.choice.explicitlyRequestedGenres,
  );

  const deduped = choice.buildRecommendationRequest(
    {
      ...state,
      genres: ["SF/판타지", "SF/판타지"],
    },
  );
  assert.deepEqual(deduped.choice.desiredGenres, ["SF", "판타지"]);
});

test("summary submission POSTs one JSON payload and navigates using the returned run id", async () => {
  const parent = await readSource(
    "src/components/choice-stepper/choice-stepper.tsx",
  );

  assert.ok(parent.includes("const payload = buildRecommendationRequest"));
  assert.ok(parent.includes('fetch("/api/recommendations"'));
  assert.ok(parent.includes('method: "POST"'));
  assert.ok(parent.includes('"content-type": "application/json"'));
  assert.ok(parent.includes("body: JSON.stringify(payload)"));
  assert.ok(parent.includes("!response.ok || !result?.runId"));
  assert.ok(
    parent.includes(
      "router.push(`/recommendations/${encodeURIComponent(result.runId)}`)",
    ),
  );
  assert.ok(parent.includes("isSubmitting"));
  assert.ok(parent.includes("submitError"));
});

test("Choice no longer exposes request or demo scenario state", async () => {
  const files = await Promise.all([
    readSource("src/components/choice-stepper/choice-types.ts"),
    readSource("src/components/choice-stepper/choice-options.ts"),
    readSource("src/components/choice-stepper/choice-state.ts"),
    readSource("src/components/choice-stepper/choice-stepper.tsx"),
    readSource("src/components/choice-stepper/step-5-extra.tsx"),
    readSource("src/components/choice-stepper/step-6-summary.tsx"),
  ]);
  const all = files.join("\n");
  for (const removed of [
    "demoLabEnabled",
    "durationBeforeApproval",
    "SET_SCENARIO",
    "SET_NATURAL_LANGUAGE",
    "SET_AVOID_GENRE",
    "SCENARIO_OPTIONS",
    "추가 요청 및 시연 설정",
  ]) {
    assert.ok(!all.includes(removed), `${removed} must not remain in Choice`);
  }
});

test("starting over forces a fresh route load after confirmation", async () => {
  const navigation = await readSource(
    "src/components/choice-stepper/choice-nav.tsx",
  );
  assert.ok(navigation.includes('window.location.assign("/choice")'));
  assert.ok(navigation.includes("function restartChoice"));
});

test("Step 5 collects an optional media type and maps it to the strict payload", async () => {
  const [choice, options] = await Promise.all([
    loadModule("src/components/choice-stepper/choice-state.ts"),
    loadModule("src/components/choice-stepper/choice-options.ts"),
  ]);

  assert.deepEqual(
    options.MEDIA_TYPE_OPTIONS.map((option) => option.value),
    ["MOVIE", "SERIES", "ANY"],
  );
  assert.equal(choice.INITIAL_CHOICE_STATE.mediaType, null);

  const selected = choice.choiceReducer(choice.INITIAL_CHOICE_STATE, {
    type: "SET_MEDIA_TYPE",
    value: "SERIES",
  });
  assert.equal(selected.mediaType, "SERIES");
  assert.equal(choice.isChoiceDraftDirty(selected), true);
  assert.equal(
    choice.buildRecommendationRequest(selected).choice.mediaType,
    "SERIES",
  );

  // Step 5 stays optional: an untouched media type must not narrow results.
  assert.equal(
    choice.buildRecommendationRequest(choice.INITIAL_CHOICE_STATE).choice
      .mediaType,
    "ANY",
  );
});

test("the media type survives the natural-language handoff into Choice", async () => {
  const natural = await loadModule(
    "src/components/natural-recommendation/natural-language.ts",
  );

  const interpretation = natural.interpretNaturalRequest(
    "주말에 볼 시리즈 추천해줘",
  );
  assert.equal(interpretation.draft.mediaType, "SERIES");
  assert.equal(
    natural.toChoiceHandoffDraft(interpretation).mediaType,
    "SERIES",
  );

  // The handoff snapshot is an explicit allowlist, so a dropped field would be
  // silent at runtime. Assert on the source that it copies the media type.
  const handoff = await readSource(
    "src/components/choice-handoff/choice-handoff-provider.tsx",
  );
  assert.match(handoff, /mediaType:\s*draft\.mediaType/);
});
