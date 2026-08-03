import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const rootPath = path.resolve(import.meta.dirname, "..");

async function read(relativePath) {
  return readFile(path.resolve(rootPath, relativePath), "utf8");
}

test("public screens share AppShell and the same outer container", async () => {
  const [shell, landing, choice, natural, resultPage, css] = await Promise.all([
    read("src/components/app-shell.tsx"),
    read("src/components/landing/landing-page.tsx"),
    read("src/components/choice-stepper/choice-stepper.tsx"),
    read(
      "src/components/natural-recommendation/natural-recommendation-flow.tsx",
    ),
    read("src/app/recommendations/[runId]/page.tsx"),
    read("src/app/globals.css"),
  ]);

  for (const source of [landing, choice, natural, resultPage]) {
    assert.match(source, /<AppShell\b/);
  }
  assert.match(shell, /data-app-shell="true"/);
  assert.match(shell, /className="app-container flex h-16/);
  assert.match(css, /--app-container-max:\s*80rem/);
  assert.match(
    css,
    /\.app-container[\s\S]*?padding-inline:\s*1rem[\s\S]*?min-width:\s*640px[\s\S]*?padding-inline:\s*1\.5rem[\s\S]*?min-width:\s*1024px[\s\S]*?padding-inline:\s*2rem/,
  );
});

test("desktop layouts do not retain mobile-width constraints", async () => {
  const [css, choice, input, naturalResult, result] = await Promise.all([
    read("src/app/globals.css"),
    read("src/components/choice-stepper/choice-stepper.tsx"),
    read("src/components/natural-recommendation/natural-input-step.tsx"),
    read("src/components/natural-recommendation/natural-result.tsx"),
    read("src/components/recommendation-view.tsx"),
  ]);
  const activeUiCss = css.slice(css.indexOf("/* Choice stepper"));

  assert.doesNotMatch(activeUiCss, /760px|1120px|1200px|max-width:\s*900px/);
  assert.match(choice, /app-container choice-stepper-main/);
  assert.match(input, /app-container flex flex-1/);
  for (const source of [naturalResult, result]) {
    assert.match(
      source,
      /md:grid md:grid-cols-2[\s\S]*?lg:grid-cols-3[\s\S]*?xl:grid-cols-5/,
    );
  }
});

test("CSS layout switches align to the shared responsive breakpoints", async () => {
  const css = await read("src/app/globals.css");

  assert.doesNotMatch(
    css,
    /@media \((?:min|max)-width:\s*(?:820|900|1100)px\)/,
  );
  assert.match(css, /@media \(min-width: 640px\)/);
  assert.match(css, /@media \(min-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 1023px\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /@media \(max-width: 639px\)/);
});
