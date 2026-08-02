import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const rootPath = path.resolve(import.meta.dirname, "..");
const componentPath = path.resolve(rootPath, "src/components");

async function collectTsxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.resolve(directory, entry.name);
      if (entry.isDirectory()) return collectTsxFiles(absolutePath);
      return entry.name.endsWith(".tsx") ? [absolutePath] : [];
    }),
  );
  return nested.flat();
}

test("active UI components keep user-facing text at 14px or larger", async () => {
  const files = await collectTsxFiles(componentPath);

  for (const file of files) {
    const source = await readFile(file, "utf8");
    const relativePath = path.relative(rootPath, file);
    const withoutLegalFooter =
      relativePath === "src\\components\\landing\\landing-footer.tsx"
        ? source.replace(
            /<div className="flex flex-col gap-2 border-t[\s\S]*?<\/div>/,
            "",
          )
        : source;

    assert.doesNotMatch(
      withoutLegalFooter,
      /\btext-xs\b|text-\[0\.[0-9]+rem\]/,
      `${relativePath} must not render user-facing text below 14px`,
    );
  }
});

test("body explanations stay at 16px while legal footer copy may use 12px", async () => {
  const [hero, features, showcase, footer, input, choiceSteps] = await Promise.all([
    readFile(path.resolve(componentPath, "landing/landing-hero.tsx"), "utf8"),
    readFile(path.resolve(componentPath, "landing/landing-features.tsx"), "utf8"),
    readFile(path.resolve(componentPath, "landing/recommendation-showcase.tsx"), "utf8"),
    readFile(path.resolve(componentPath, "landing/landing-footer.tsx"), "utf8"),
    readFile(
      path.resolve(componentPath, "natural-recommendation/natural-input-step.tsx"),
      "utf8",
    ),
    Promise.all(
      [1, 2, 3, 4, 5, 6].map((step) =>
        readFile(
          path.resolve(
            componentPath,
            `choice-stepper/step-${step}-${[
              "who",
              "time",
              "ott",
              "mood",
              "extra",
              "summary",
            ][step - 1]}.tsx`,
          ),
          "utf8",
        ),
      ),
    ),
  ]);

  for (const source of [hero, features, showcase, input, ...choiceSteps]) {
    assert.match(source, /text-base[^"\n]*leading-7/);
  }
  assert.equal([...footer.matchAll(/\btext-xs\b/g)].length, 1);
  assert.match(footer, /© 2026 OTT 다모아/);
  assert.match(footer, /실제 시청 전 다시 확인해 주세요/);
});

test("shared dark UI CSS enforces readable labels and descriptions", async () => {
  const css = await readFile(path.resolve(rootPath, "src/app/globals.css"), "utf8");
  const modernUi = css.slice(css.indexOf("/* Choice stepper"));
  const modernPixelSizes = [...modernUi.matchAll(/font-size:\s*(\d+)px/g)].map(
    (match) => Number(match[1]),
  );

  assert.ok(modernPixelSizes.length > 0);
  assert.ok(modernPixelSizes.every((size) => size >= 14));
  for (const contract of [
    /\.provider-badge[\s\S]*?font-size:\s*14px/,
    /\.poster-art__meta[\s\S]*?font-size:\s*14px/,
    /\.result-notice strong[\s\S]*?font-size:\s*16px/,
    /\.result-notice p[\s\S]*?font-size:\s*14px/,
    /\.recommendation-waiting__description[\s\S]*?font-size:\s*16px/,
  ]) {
    assert.match(css, contract);
  }
});
