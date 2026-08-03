import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function read(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("completed choice and natural results share card replacement", async () => {
  const [completed, natural, choice] = await Promise.all([
    read("src/components/completed-recommendation-result.tsx"),
    read("src/components/natural-recommendation/natural-result.tsx"),
    read("src/components/recommendation-view.tsx"),
  ]);

  assert.match(natural, /<CompletedRecommendationResult/);
  assert.match(choice, /<CompletedRecommendationResult/);
  assert.match(completed, /<ReplacementFeedbackNotice feedback=\{replacementFeedback\} \/>/);

  const completedCards = [...completed.matchAll(/<ContentCard[\s\S]*?\/>/g)].map(
    (match) => match[0],
  );
  assert.equal(completedCards.length, 2, "top pick and alternatives");
  assert.ok(completedCards.every((card) => card.includes("onReplace")));

  const partialBlock = natural.slice(natural.indexOf("partialRecommendations.map"));
  assert.ok(!partialBlock.slice(0, partialBlock.indexOf("/>")).includes("onReplace"));
});

test("shared replacement uses the completed run and prevents duplicate requests", async () => {
  const source = await read("src/components/completed-recommendation-result.tsx");

  assert.match(source, /\/replacement`/);
  assert.match(source, /JSON\.stringify\(\{ contentId \}\)/);
  assert.match(source, /if \(replacementLock\.current\) return/);
  assert.match(source, /replacementLock\.current = true/);
  assert.match(source, /replacementLock\.current = false/);
  assert.match(source, /request\.status === 400 \? "exhausted" : "error"/);
  assert.match(source, /onResponseChange\(await requestReplacement/);
});

test("the card action row stays anchored to the card floor", async () => {
  const source = await read("src/components/content-card.tsx");

  assert.match(
    source,
    /className="mt-auto flex items-center justify-between gap-3 border-t/,
  );
  assert.ok(
    !/className="mt-5 flex items-center justify-between gap-3 border-t/.test(source),
  );
});
