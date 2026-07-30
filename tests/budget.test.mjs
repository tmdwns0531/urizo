import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadBudgetModule() {
  const sourceUrl = new URL(
    "../src/domains/recommendation/budget.ts",
    import.meta.url,
  );
  const source = await readFile(sourceUrl, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const encoded = Buffer.from(outputText).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

test("BudgetCounter runTool rejects at the elapsed deadline", async () => {
  const { BudgetCounter, BudgetExceededError } = await loadBudgetModule();
  const budget = new BudgetCounter({
    modelCalls: 3,
    toolCalls: 2,
    tokens: 8_000,
    elapsedMs: 25,
  });
  const startedAt = Date.now();

  await assert.rejects(
    budget.runTool(
      () =>
        new Promise((resolve) => {
          const timer = setTimeout(() => resolve("too late"), 250);
          timer.unref?.();
        }),
    ),
    (error) => {
      assert.ok(error instanceof BudgetExceededError);
      assert.equal(error.snapshot.toolCalls, 1);
      assert.ok(error.snapshot.elapsedMs >= 20);
      return true;
    },
  );

  assert.ok(
    Date.now() - startedAt < 200,
    "runTool must reject near the deadline instead of awaiting completion",
  );
});