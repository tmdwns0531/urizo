import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function read(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("the natural-language result offers replacement on every completed card", async () => {
  const source = await read(
    "src/components/natural-recommendation/natural-result.tsx",
  );

  // The top pick and each alternative must forward the handler; ContentCard
  // renders the control only when `onReplace` is present.
  const cardBlocks = [...source.matchAll(/<ContentCard[\s\S]*?\/>/g)].map(
    (match) => match[0],
  );
  assert.equal(cardBlocks.length, 3, "top pick, alternatives, partial results");
  assert.equal(
    cardBlocks.filter((block) => block.includes("onReplace")).length,
    2,
    "only the two completed surfaces forward onReplace",
  );

  // Partial results belong to an AWAITING_APPROVAL run, and the replacement
  // endpoint only accepts COMPLETED runs, so that card must stay read-only.
  const partialBlock = source.slice(source.indexOf("partialRecommendations.map"));
  const partialCard = partialBlock.slice(0, partialBlock.indexOf("/>"));
  assert.ok(
    !partialCard.includes("onReplace"),
    "approval-pending cards must not offer replacement",
  );

  assert.match(source, /<ReplacementFeedbackNotice feedback=\{replacementFeedback\} \/>/);
});

test("the natural flow drives replacement through the run's ranked mode", async () => {
  const source = await read(
    "src/components/natural-recommendation/natural-recommendation-flow.tsx",
  );

  assert.match(source, /async function replaceContent\(contentId: string\)/);
  assert.match(source, /\/replacement`/);
  assert.match(source, /JSON\.stringify\(\{ contentId \}\)/);

  // A completed run is the only valid source, and a concurrent second click
  // must not fire a second request.
  assert.match(source, /response\?\.status !== "completed" \|\| replacementLock\.current/);
  assert.match(source, /replacementLock\.current = true/);
  assert.match(source, /replacementLock\.current = false/);

  // An exhausted candidate pool is a normal outcome, not a transport failure.
  assert.match(source, /request\.status === 400\s*\?\s*REPLACEMENT_FEEDBACK\.exhausted/);

  // Starting a new recommendation must not keep a stale replacement notice.
  for (const action of ["SHOW_RESULT", "SHOW_INPUT", "START_REQUEST"]) {
    const block = source.slice(source.indexOf(`case "${action}"`));
    assert.match(
      block.slice(0, 400),
      /replacementFeedback: null/,
      `${action} must clear the replacement notice`,
    );
  }
});

test("both result surfaces share one replacement vocabulary", async () => {
  const [flow, view] = await Promise.all([
    read("src/components/natural-recommendation/natural-recommendation-flow.tsx"),
    read("src/components/recommendation-view.tsx"),
  ]);

  assert.match(view, /export const REPLACEMENT_FEEDBACK/);
  assert.match(flow, /REPLACEMENT_FEEDBACK/);
  assert.ok(
    !flow.includes("같은 조건의 다른 후보가 없어요"),
    "copy must come from the shared constant, not a duplicate literal",
  );
});

test("the card action row stays anchored to the card floor", async () => {
  const source = await read("src/components/content-card.tsx");

  // Badge rows and meta lines wrap at different lengths per title, so a fixed
  // top margin let the action row drift up by one line between cards.
  assert.match(
    source,
    /className="mt-auto flex items-center justify-between gap-3 border-t/,
  );
  assert.ok(
    !/className="mt-5 flex items-center justify-between gap-3 border-t/.test(source),
    "the fixed top margin must not come back",
  );
});
