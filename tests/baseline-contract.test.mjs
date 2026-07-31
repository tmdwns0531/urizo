import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

const execFileAsync = promisify(execFile);
const root = new URL("../", import.meta.url);
const rootPath = fileURLToPath(root);

async function read(relativePath) {
  return readFile(new URL(relativePath, root), "utf8");
}

async function loadStandaloneTypeScriptModule(relativePath) {
  const source = await read(relativePath);
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const encoded = Buffer.from(outputText).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

function declarationNames(source, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const names = new Set();
  for (const node of sourceFile.statements) {
    if (
      "name" in node &&
      node.name &&
      ts.canHaveModifiers(node) &&
      ts
        .getModifiers(node)
        ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
    ) {
      names.add(node.name.text);
    }
  }
  return names;
}

function delimitedBlock(source, kind, name) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex(
    (line) => line.trim() === `${kind} ${name} {`,
  );
  assert.notEqual(start, -1, `${kind} ${name} must exist`);

  let depth = 0;
  const body = [];
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    depth += (line.match(/\{/g) ?? []).length;
    depth -= (line.match(/\}/g) ?? []).length;
    if (index > start && depth > 0) {
      body.push(line);
    }
    if (index > start && depth === 0) {
      return body;
    }
  }
  assert.fail(`${kind} ${name} has no closing brace`);
}

function parsePrismaModel(source, name) {
  return delimitedBlock(source, "model", name)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("//") && !line.startsWith("@@"))
    .map((line) => {
      const [fieldName, type, ...attributeParts] = line.split(/\s+/);
      const attributes = attributeParts.join(" ");
      return {
        name: fieldName,
        type,
        mappedName:
          attributes.match(/@map\("([^"]+)"\)/)?.[1] ?? fieldName,
        attributes,
        nullable: type.endsWith("?"),
      };
    });
}

function parsePrismaEnum(source, name) {
  return delimitedBlock(source, "enum", name)
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter(Boolean);
}

function parseMermaidEntity(source, name) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex(
    (line) => line.trim() === `${name} {`,
  );
  assert.notEqual(start, -1, `ERD entity ${name} must exist`);

  const fields = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === "}") {
      return fields;
    }
    if (!line) {
      continue;
    }
    const [type, fieldName, ...detail] = line.split(/\s+/);
    fields.push({
      name: fieldName,
      type,
      detail: detail.join(" "),
    });
  }
  assert.fail(`ERD entity ${name} has no closing brace`);
}

function parseSqlEnum(source, name) {
  const match = source.match(
    new RegExp(`CREATE TYPE "${name}" AS ENUM \\(([^;]+)\\);`),
  );
  assert.ok(match, `SQL enum ${name} must exist`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((value) => value[1]);
}

function sqlTableBlock(source, name) {
  const match = source.match(
    new RegExp(
      `CREATE TABLE "${name}" \\(([\\s\\S]*?)\\n\\);`,
    ),
  );
  assert.ok(match, `SQL table ${name} must exist`);
  return match[1];
}

function parseSqlTable(source, name) {
  return sqlTableBlock(source, name)
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => line.startsWith('"'))
    .map((line) => {
      const match = line.match(/^"([^"]+)"\s+(.+)$/);
      assert.ok(match, `cannot parse SQL column: ${line}`);
      const columnName = match[1];
      const rest = match[2];
      const constraintStart = rest.search(
        /\s+(?:NOT NULL|NULL|DEFAULT|REFERENCES|CONSTRAINT)\b/,
      );
      return {
        name: columnName,
        type:
          constraintStart === -1
            ? rest
            : rest.slice(0, constraintStart),
        nullable: !/\bNOT NULL\b/.test(rest),
        defaultValue: rest.match(/\bDEFAULT\s+(.+)$/)?.[1] ?? null,
      };
    });
}

const runContract = [
  ["id", "String", "id", "VARCHAR(64)", "varchar_64", false],
  [
    "status",
    "RecommendationRunStatus",
    "status",
    '"RecommendationRunStatus"',
    "RecommendationRunStatus",
    false,
  ],
  ["revision", "Int", "revision", "INTEGER", "int", false],
  [
    "executionMode",
    "RecommendationExecutionMode",
    "execution_mode",
    '"RecommendationExecutionMode"',
    "RecommendationExecutionMode",
    false,
  ],
  [
    "inputFingerprint",
    "String",
    "input_fingerprint",
    "VARCHAR(71)",
    "varchar_71",
    false,
  ],
  [
    "requestSnapshot",
    "Json",
    "request_snapshot",
    "JSONB",
    "json",
    false,
  ],
  ["queryVector", "Json", "query_vector", "JSONB", "json", false],
  [
    "responseSnapshot",
    "Json?",
    "response_snapshot",
    "JSONB",
    "json",
    true,
  ],
  [
    "excludedContentIds",
    "String[]",
    "excluded_content_ids",
    "TEXT[]",
    "text_array",
    false,
  ],
  [
    "replacedContentIds",
    "String[]",
    "replaced_content_ids",
    "TEXT[]",
    "text_array",
    false,
  ],
  ["candidateCount", "Int", "candidate_count", "INTEGER", "int", false],
  ["resultCount", "Int", "result_count", "INTEGER", "int", false],
  [
    "modelCallCount",
    "Int",
    "model_call_count",
    "INTEGER",
    "int",
    false,
  ],
  [
    "toolCallCount",
    "Int",
    "tool_call_count",
    "INTEGER",
    "int",
    false,
  ],
  ["totalTokens", "Int", "total_tokens", "INTEGER", "int", false],
  ["durationMs", "Int", "duration_ms", "INTEGER", "int", false],
  [
    "policyBlockCount",
    "Int",
    "policy_block_count",
    "INTEGER",
    "int",
    false,
  ],
  [
    "fallbackReason",
    "String?",
    "fallback_reason",
    "VARCHAR(32)",
    "varchar_32",
    true,
  ],
  [
    "errorCode",
    "String?",
    "error_code",
    "VARCHAR(32)",
    "varchar_32",
    true,
  ],
  [
    "startedAt",
    "DateTime",
    "started_at",
    "TIMESTAMPTZ(3)",
    "timestamptz",
    false,
  ],
  [
    "completedAt",
    "DateTime?",
    "completed_at",
    "TIMESTAMPTZ(3)",
    "timestamptz",
    true,
  ],
  [
    "createdAt",
    "DateTime",
    "created_at",
    "TIMESTAMPTZ(3)",
    "timestamptz",
    false,
  ],
  [
    "updatedAt",
    "DateTime",
    "updated_at",
    "TIMESTAMPTZ(3)",
    "timestamptz",
    false,
  ],
];

const traceContract = [
  ["id", "String", "id", "VARCHAR(64)", "varchar_64", false],
  ["runId", "String", "run_id", "VARCHAR(64)", "varchar_64", false],
  ["sequence", "Int", "sequence", "INTEGER", "int", false],
  [
    "action",
    "TraceAction",
    "action",
    '"TraceAction"',
    "TraceAction",
    false,
  ],
  [
    "visibility",
    "TraceVisibility",
    "visibility",
    '"TraceVisibility"',
    "TraceVisibility",
    false,
  ],
  ["detail", "Json", "detail", "JSONB", "json", false],
  [
    "publicMessage",
    "String?",
    "public_message",
    "TEXT",
    "text",
    true,
  ],
  ["durationMs", "Int?", "duration_ms", "INTEGER", "int", true],
  [
    "createdAt",
    "DateTime",
    "created_at",
    "TIMESTAMPTZ(3)",
    "timestamptz",
    false,
  ],
];

function assertPersistenceLayer(
  contract,
  prismaFields,
  sqlColumns,
  erdFields,
) {
  assert.deepEqual(
    prismaFields.map((field) => field.name),
    contract.map(([name]) => name),
  );
  assert.deepEqual(
    sqlColumns.map((column) => column.name),
    contract.map((entry) => entry[2]),
  );
  assert.deepEqual(
    erdFields.map((field) => field.name),
    contract.map(([name]) => name),
  );

  for (const [
    name,
    prismaType,
    sqlName,
    sqlType,
    erdType,
    nullable,
  ] of contract) {
    const prismaField = prismaFields.find((field) => field.name === name);
    const sqlColumn = sqlColumns.find((column) => column.name === sqlName);
    const erdField = erdFields.find((field) => field.name === name);

    assert.equal(prismaField.type, prismaType, `${name} Prisma type`);
    assert.equal(prismaField.mappedName, sqlName, `${name} SQL mapping`);
    assert.equal(prismaField.nullable, nullable, `${name} Prisma nullability`);
    assert.equal(sqlColumn.type, sqlType, `${sqlName} SQL type`);
    assert.equal(sqlColumn.nullable, nullable, `${sqlName} SQL nullability`);
    assert.equal(erdField.type, erdType, `${name} ERD type`);
    if (nullable) {
      assert.match(erdField.detail, /nullable/, `${name} ERD nullability`);
    }
  }
}

test("v0.7 compile-time contract assertions pass as a real TypeScript program", () => {
  const configPath = fileURLToPath(new URL("tsconfig.json", root));
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(configFile.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    rootPath,
  );
  const typeTestPath = fileURLToPath(
    new URL("tests/v07-baseline.type-test.ts", root),
  );
  const program = ts.createProgram({
    rootNames: [typeTestPath],
    options: {
      ...parsed.options,
      incremental: false,
    },
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: () => rootPath,
      getNewLine: () => "\n",
    }),
  );
});

test("v0.7 active TypeScript contract names are exported", async () => {
  const files = {
    catalog: await read("src/contracts/catalog.ts"),
    search: await read("src/contracts/mvp-search.ts"),
    recommendation: await read("src/contracts/mvp-recommendation.ts"),
    ports: await read("src/contracts/mvp-ports.ts"),
    api: await read("src/contracts/mvp-api.ts"),
    executors: await read("src/domains/recommendation/executors/types.ts"),
    composition: await read("src/composition/types.ts"),
    config: await read("src/config/adapters.ts"),
  };

  const exported = new Set(
    Object.entries(files).flatMap(([name, source]) => [
      ...declarationNames(source, name),
    ]),
  );

  for (const required of [
    "RecommendationSearchAdapter",
    "RecommendationSelectorAdapter",
    "RecommendationRunRepository",
    "AgentTraceRepository",
    "MvpRecommendationExecutor",
    "AnonymousRecommendationServices",
    "MvpAdapterConfig",
    "MvpAdapterSet",
    "MvpComposition",
    "MvpDemoApiContract",
    "MvpRecommendationChoice",
    "MvpRecommendationRequest",
    "ProviderLinkType",
    "QueryVectorSnapshot",
    "RecommendationSearchContinuation",
    "SanitizedRecommendationSearchInput",
    "ExecutionAttempt",
    "RuleBasedFallbackInput",
    "StoredRecommendationRun",
    "TraceMetrics",
    "PublicErrorCode",
  ]) {
    assert.ok(exported.has(required), `${required} must be exported`);
  }
});

test("ERD, Prisma schema, and migration share one exact persistence contract", async () => {
  const [schema, migration, erd] = await Promise.all([
    read("prisma/schema.prisma"),
    read(
      "prisma/migrations/20260731090000_v07_run_trace_baseline/migration.sql",
    ),
    read("docs/ERD-v0.7-baseline.md"),
  ]);

  const modelNames = [...schema.matchAll(/^model (\w+) \{/gm)].map(
    (match) => match[1],
  );
  const tableNames = [...migration.matchAll(/CREATE TABLE "([^"]+)"/g)].map(
    (match) => match[1],
  );
  const erdEntityNames = [...erd.matchAll(/^\s{2}(\w+) \{$/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(modelNames, ["RecommendationRun", "AgentTrace"]);
  assert.deepEqual(tableNames, ["recommendation_runs", "agent_traces"]);
  assert.deepEqual(erdEntityNames, ["RecommendationRun", "AgentTrace"]);

  const runFields = parsePrismaModel(schema, "RecommendationRun").filter(
    (field) => field.name !== "traces",
  );
  const traceFields = parsePrismaModel(schema, "AgentTrace").filter(
    (field) => field.name !== "run",
  );
  assertPersistenceLayer(
    runContract,
    runFields,
    parseSqlTable(migration, "recommendation_runs"),
    parseMermaidEntity(erd, "RecommendationRun"),
  );
  assertPersistenceLayer(
    traceContract,
    traceFields,
    parseSqlTable(migration, "agent_traces"),
    parseMermaidEntity(erd, "AgentTrace"),
  );

  const enums = {
    RecommendationRunStatus: [
      "RUNNING",
      "AWAITING_APPROVAL",
      "COMPLETED",
      "FAILED",
    ],
    RecommendationExecutionMode: [
      "DETERMINISTIC",
      "OPENAI",
      "FALLBACK",
    ],
    TraceVisibility: ["INTERNAL", "PUBLIC"],
    TraceAction: [
      "filter",
      "vector_search",
      "score",
      "select",
      "policy_block",
      "approval_request",
      "approval_decision",
      "fallback",
      "replacement",
      "complete",
    ],
  };
  for (const [name, values] of Object.entries(enums)) {
    assert.deepEqual(parsePrismaEnum(schema, name), values);
    assert.deepEqual(parseSqlEnum(migration, name), values);
  }

  const run = parsePrismaModel(schema, "RecommendationRun");
  assert.ok(
    run.find((field) => field.name === "id")
      .attributes.includes("@db.VarChar(64)"),
  );
  assert.ok(
    run.find((field) => field.name === "inputFingerprint")
      .attributes.includes("@db.VarChar(71)"),
  );
  assert.ok(
    parsePrismaModel(schema, "AgentTrace")
      .find((field) => field.name === "runId")
      .attributes.includes("@db.VarChar(64)"),
  );
  assert.match(
    schema,
    /@@unique\(\[runId, sequence\], map: "agent_traces_run_sequence_key"\)/,
  );
  assert.match(
    migration,
    /UNIQUE INDEX "agent_traces_run_sequence_key".+\("run_id", "sequence"\)/,
  );

  const forbiddenPersistenceNames =
    /\b(userId|userSnapshot|naturalLanguage|matchedTerms|rawPrompt)\b/;
  assert.doesNotMatch(schema, forbiddenPersistenceNames);
  assert.doesNotMatch(migration, forbiddenPersistenceNames);
  assert.doesNotMatch(
    migration,
    /DATABASE_URL|DIRECT_URL|postgres(?:ql)?:\/\/|api[_-]?key|secret/i,
  );
});

test("Prisma CLI validates the schema without caller-provided URLs", async () => {
  const env = { ...process.env };
  delete env.DATABASE_URL;
  delete env.DIRECT_URL;
  await execFileAsync(
    process.execPath,
    [
      fileURLToPath(
        new URL("scripts/prisma-validate.mjs", root),
      ),
    ],
    {
      cwd: rootPath,
      env,
      timeout: 30_000,
    },
  );
});

test("opaque Run and Trace IDs use the persisted prefixed UUID format", async () => {
  const ids = await loadStandaloneTypeScriptModule(
    "src/adapters/shared/id.ts",
  );
  const uuid =
    "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
  assert.match(ids.createId("run"), new RegExp(`^run_${uuid}$`, "i"));
  assert.match(ids.createId("trace"), new RegExp(`^trace_${uuid}$`, "i"));
});

test("six API method, path, status, and DTO contracts are fixed", async () => {
  const api = await loadStandaloneTypeScriptModule(
    "src/contracts/mvp-api.ts",
  );
  assert.deepEqual(api.MVP_API_ENDPOINTS, {
    createRecommendation: {
      method: "POST",
      path: "/api/recommendations",
      successStatus: 201,
      errorStatuses: [400, 500],
    },
    getRecommendation: {
      method: "GET",
      path: "/api/recommendations/{runId}",
      successStatus: 200,
      errorStatuses: [404, 500],
    },
    decideApproval: {
      method: "POST",
      path: "/api/recommendations/{runId}/approval",
      successStatus: 200,
      errorStatuses: [400, 404, 500],
    },
    replaceRecommendation: {
      method: "POST",
      path: "/api/recommendations/{runId}/replacement",
      successStatus: 200,
      errorStatuses: [400, 404, 500],
    },
    health: {
      method: "GET",
      path: "/api/health",
      successStatus: 200,
      errorStatuses: [500],
    },
    resetDemo: {
      method: "POST",
      path: "/api/demo/reset",
      successStatus: 200,
      errorStatuses: [404, 500],
    },
  });

  const source = await read("src/contracts/mvp-api.ts");
  assert.doesNotMatch(source, /\/api\/search/);
});

test("runtime allowlists and budget limits match v0.6 and v0.7", async () => {
  const contract = await loadStandaloneTypeScriptModule(
    "src/contracts/mvp-recommendation.ts",
  );
  assert.deepEqual(contract.PUBLIC_ERROR_CODES, [
    "BAD_REQUEST",
    "NOT_FOUND",
    "INTERNAL_ERROR",
  ]);
  assert.deepEqual(contract.MVP_BUDGET_LIMITS, {
    modelCalls: 3,
    toolCalls: 2,
    tokens: 8_000,
    elapsedMs: 25_000,
  });
  assert.deepEqual(contract.TRACE_METRIC_KEYS, [
    "candidateCount",
    "eligibleCount",
    "resultCount",
    "blockedCount",
    "modelCalls",
    "toolCalls",
    "tokens",
    "durationMs",
    "effectiveRuntimeMinutes",
  ]);
});

test("MVP adapter config validates real credentials only when selected", async () => {
  const config = await loadStandaloneTypeScriptModule(
    "src/config/adapters.ts",
  );
  const defaults = {
    appProfile: "demo",
    catalog: "fixture",
    search: "local",
    selector: "deterministic",
    runStore: "memory",
    traceStore: "memory",
  };
  assert.deepEqual(config.MVP_DEFAULT_ADAPTER_CONFIG, defaults);
  assert.deepEqual(config.readMvpAdapterConfig({}), defaults);
  assert.equal(config.isFullyMvpDemoConfig(defaults), true);
  assert.doesNotThrow(() =>
    config.validateSelectedMvpAdapters(defaults, {}),
  );

  const prismaSelected = {
    ...defaults,
    runStore: "prisma",
  };
  assert.throws(
    () => config.validateSelectedMvpAdapters(prismaSelected, {}),
    /DATABASE_URL, DIRECT_URL/,
  );
  assert.doesNotThrow(() =>
    config.validateSelectedMvpAdapters(prismaSelected, {
      DATABASE_URL: "provided-by-runtime-secret-store",
      DIRECT_URL: "provided-by-runtime-secret-store",
    }),
  );

  const openAiSelected = {
    ...defaults,
    selector: "openai",
  };
  assert.throws(
    () => config.validateSelectedMvpAdapters(openAiSelected, {}),
    /OPENAI_API_KEY/,
  );
  assert.throws(
    () =>
      config.readMvpAdapterConfig({
        CATALOG_ADAPTER: "prisma",
      }),
    /CATALOG_ADAPTER must be one of fixture/,
  );
});
