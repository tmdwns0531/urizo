import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function read(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("the one-sentence nav reveals the watchlist only once results exist", async () => {
  const [nav, flow] = await Promise.all([
    read("src/components/natural-recommendation/natural-nav.tsx"),
    read("src/components/natural-recommendation/natural-recommendation-flow.tsx"),
  ]);

  assert.match(nav, /import \{ WatchlistNavLink \}/);
  assert.match(flow, /onResult=\{state\.step === "result"\}/);

  // Label and link are one decision: they always appear together, so a single
  // guard keeps them from drifting apart.
  const guardStart = nav.indexOf("{onResult ?");
  const guardEnd = nav.indexOf(") : null}", guardStart);
  assert.ok(guardStart >= 0 && guardEnd > guardStart, "the guard must exist");
  const guarded = nav.slice(guardStart, guardEnd);

  assert.ok(guarded.includes("추천 결과"), "the result label sits inside the guard");
  assert.ok(guarded.includes("<WatchlistNavLink />"), "so does the watchlist link");

  // Leaving must stay possible from every step, so reset stays ungated.
  assert.ok(
    !guarded.includes("처음부터"),
    "the reset button must not be hidden before results",
  );
});

test("both input screens agree on hiding the watchlist", async () => {
  const [naturalNav, choiceNav] = await Promise.all([
    read("src/components/natural-recommendation/natural-nav.tsx"),
    read("src/components/choice-stepper/choice-nav.tsx"),
  ]);

  // The button-driven path never shows it while conditions are being entered;
  // the one-sentence path must not either.
  assert.ok(
    !choiceNav.includes("WatchlistNavLink"),
    "the Choice input nav stays free of the watchlist",
  );
  assert.ok(naturalNav.includes("{onResult ?"));
});
