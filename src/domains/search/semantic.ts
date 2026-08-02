import type { CatalogContent } from "../../contracts/catalog";
import {
  LOCAL_QUERY_VECTOR_ALGORITHM,
  LOCAL_QUERY_VECTOR_DIMENSIONS,
  OPENAI_QUERY_VECTOR_ALGORITHM,
  OPENAI_QUERY_VECTOR_DIMENSIONS,
  type InputFingerprint,
  type LocalQueryVectorSnapshot,
  type OpenAiQueryVectorSnapshot,
  type QueryVectorSnapshot,
  type RecommendationSearchContinuation,
  type SanitizedRecommendationSearchInput,
} from "../../contracts/mvp-search";

const SEMANTIC_GROUPS: readonly (readonly string[])[] = [
  ["웃긴", "웃음", "코미디", "유쾌한", "재치있는", "가벼운", "즐거운"],
  ["따뜻한", "위로", "힐링", "편안한", "잔잔한", "다정한"],
  ["긴장", "긴장감", "스릴러", "미스터리", "추리", "몰입", "반전"],
  ["감성", "감성적인", "로맨스", "사랑", "낭만", "눈물"],
  ["가족", "아이", "어린이", "함께", "애니메이션"],
  ["액션", "모험", "속도감", "영웅", "히어로"],
  ["생각", "여운", "철학", "사회", "진한", "드라마"],
  ["어두운", "공포", "무서운", "강렬한", "자극적인"],
  ["음악", "노래", "재즈", "밴드"],
] as const;

const normalize = (text: string): string =>
  text
    .toLocaleLowerCase("ko-KR")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");

/** Tokens are transient implementation details and must never enter contracts. */
export function tokenize(text: string): string[] {
  const base = normalize(text)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
  const expanded = new Set(base);

  for (const term of base) {
    for (const group of SEMANTIC_GROUPS) {
      if (group.some((word) => term.includes(word) || word.includes(term))) {
        group.forEach((word) => expanded.add(word));
      }
    }
  }

  return [...expanded];
}

function hashTerm(term: string, dimensions: number): number {
  let hash = 2166136261;
  for (let index = 0; index < term.length; index += 1) {
    hash ^= term.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % dimensions;
}

function vectorize(
  tokens: readonly string[],
  dimensions: number,
): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const token of tokens) {
    vector[hashTerm(token, dimensions)] += 1;
    for (let index = 0; index < token.length - 1; index += 1) {
      vector[hashTerm(token.slice(index, index + 2), dimensions)] += 0.35;
    }
  }
  return vector;
}

export function cosineSimilarity(
  left: readonly number[],
  right: readonly number[],
): number {
  if (left.length !== right.length) {
    throw new QueryVectorValidationError("vector dimensions must match");
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (!Number.isFinite(left[index]) || !Number.isFinite(right[index])) {
      throw new QueryVectorValidationError("vector values must be finite");
    }
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }
  return Math.max(
    0,
    Math.min(1, dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))),
  );
}

export function contentDocument(content: CatalogContent): string {
  return [
    content.title,
    content.synopsis,
    content.genres.join(" "),
    content.moodTags.join(" "),
    content.companionTags.join(" "),
  ].join(" ");
}

export class QueryVectorValidationError extends Error {
  readonly name = "QueryVectorValidationError";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function assertExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new QueryVectorValidationError(
      `query vector fields must be exactly ${expected.join(", ")}`,
    );
  }
}

export function parseQueryVectorSnapshot(
  value: unknown,
): QueryVectorSnapshot {
  if (!isRecord(value)) {
    throw new QueryVectorValidationError("query vector must be an object");
  }
  assertExactKeys(value, ["algorithm", "version", "dimensions", "values"]);
  if (value.version !== 1) {
    throw new QueryVectorValidationError("query vector version must be 1");
  }

  let dimensions: 64 | 1536;
  if (value.algorithm === LOCAL_QUERY_VECTOR_ALGORITHM) {
    dimensions = LOCAL_QUERY_VECTOR_DIMENSIONS;
  } else if (value.algorithm === OPENAI_QUERY_VECTOR_ALGORITHM) {
    dimensions = OPENAI_QUERY_VECTOR_DIMENSIONS;
  } else {
    throw new QueryVectorValidationError("unsupported query vector algorithm");
  }
  if (value.dimensions !== dimensions) {
    throw new QueryVectorValidationError(
      `query vector dimensions must be ${dimensions}`,
    );
  }
  if (!Array.isArray(value.values) || value.values.length !== dimensions) {
    throw new QueryVectorValidationError(
      `query vector must contain exactly ${dimensions} values`,
    );
  }
  if (!value.values.every((item) => typeof item === "number" && Number.isFinite(item))) {
    throw new QueryVectorValidationError("query vector values must be finite numbers");
  }

  if (value.algorithm === LOCAL_QUERY_VECTOR_ALGORITHM) {
    return {
      algorithm: LOCAL_QUERY_VECTOR_ALGORITHM,
      version: 1,
      dimensions: LOCAL_QUERY_VECTOR_DIMENSIONS,
      values: [...value.values],
    };
  }
  return {
    algorithm: OPENAI_QUERY_VECTOR_ALGORITHM,
    version: 1,
    dimensions: OPENAI_QUERY_VECTOR_DIMENSIONS,
    values: [...value.values],
  };
}

export function assertQueryVectorSnapshot(
  value: unknown,
): asserts value is QueryVectorSnapshot {
  parseQueryVectorSnapshot(value);
}

export function createLocalQueryVector(
  query: string,
): LocalQueryVectorSnapshot {
  return {
    algorithm: LOCAL_QUERY_VECTOR_ALGORITHM,
    version: 1,
    dimensions: LOCAL_QUERY_VECTOR_DIMENSIONS,
    values: vectorize(tokenize(query), LOCAL_QUERY_VECTOR_DIMENSIONS),
  };
}

export function createLocalContentVector(
  content: CatalogContent,
): LocalQueryVectorSnapshot {
  return createLocalQueryVector(contentDocument(content));
}

export function localVectorSimilarity(
  queryVector: LocalQueryVectorSnapshot,
  content: CatalogContent,
): number {
  const parsed = parseQueryVectorSnapshot(queryVector);
  if (parsed.algorithm !== LOCAL_QUERY_VECTOR_ALGORITHM) {
    throw new QueryVectorValidationError(
      "local search requires local-hash-cosine-v1",
    );
  }
  return cosineSimilarity(
    parsed.values,
    createLocalContentVector(content).values,
  );
}

function sortStrings(values: readonly string[]): string[] {
  return [...values].sort((left, right) => left.localeCompare(right, "ko"));
}

const FINGERPRINT_VECTOR_SIGNIFICANT_DIGITS = 12;

function fingerprintVectorValues(values: readonly number[]): string[] {
  return values.map((value) =>
    (Object.is(value, -0) ? 0 : value).toPrecision(
      FINGERPRINT_VECTOR_SIGNIFICANT_DIGITS,
    ),
  );
}

function fingerprintPayload(
  input: SanitizedRecommendationSearchInput,
  queryVector: QueryVectorSnapshot,
): Record<string, unknown> {
  const normalizedInitialChoiceWithoutNaturalLanguage: Record<string, unknown> = {
    companionAvoidGenres: sortStrings(input.companionAvoidGenres),
    companions: sortStrings(input.companions),
    desiredGenres: sortStrings(input.desiredGenres),
    hasNaturalLanguage: input.hasNaturalLanguage,
    maxRuntimeMinutes: input.maxRuntimeMinutes,
    moods: sortStrings(input.moods),
    originPreference: input.originPreference,
    selectedProviders: sortStrings(input.selectedProviders),
  };
  if (input.childAgeRatingLimit != null) {
    normalizedInitialChoiceWithoutNaturalLanguage.childAgeRatingLimit =
      input.childAgeRatingLimit;
  }
  if (input.mediaType != null && input.mediaType !== "ANY") {
    normalizedInitialChoiceWithoutNaturalLanguage.mediaType = input.mediaType;
  }
  if ((input.requiredGenres?.length ?? 0) > 0) {
    normalizedInitialChoiceWithoutNaturalLanguage.requiredGenres = sortStrings(
      input.requiredGenres,
    );
  }
  if ((input.excludedGenres?.length ?? 0) > 0) {
    normalizedInitialChoiceWithoutNaturalLanguage.excludedGenres = sortStrings(
      input.excludedGenres,
    );
  }

  return {
    normalizedInitialChoiceWithoutNaturalLanguage,
    queryVector: {
      algorithm: queryVector.algorithm,
      dimensions: queryVector.dimensions,
      values: fingerprintVectorValues(queryVector.values),
      version: queryVector.version,
    },
  };
}

/** Object keys are canonicalized; array order is preserved by design. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    .join(",")}}`;
}

export type Sha256Digest = (bytes: Uint8Array) => Promise<Uint8Array>;

async function webCryptoSha256(bytes: Uint8Array): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto SHA-256 is unavailable");
  }
  const input = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Uint8Array(await subtle.digest("SHA-256", input));
}

export async function createInputFingerprint(
  input: SanitizedRecommendationSearchInput,
  queryVectorValue: QueryVectorSnapshot,
  digest: Sha256Digest = webCryptoSha256,
): Promise<InputFingerprint> {
  const queryVector = parseQueryVectorSnapshot(queryVectorValue);
  const encoded = new TextEncoder().encode(
    canonicalJson(fingerprintPayload(input, queryVector)),
  );
  const hash = await digest(encoded);
  if (hash.length !== 32) {
    throw new Error("SHA-256 digest must contain exactly 32 bytes");
  }
  const hex = [...hash]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `sha256:${hex}`;
}

export async function verifyRecommendationSearchContinuation(
  input: SanitizedRecommendationSearchInput,
  continuation: RecommendationSearchContinuation,
  digest: Sha256Digest = webCryptoSha256,
): Promise<QueryVectorSnapshot> {
  const queryVector = parseQueryVectorSnapshot(continuation.queryVector);
  if (!/^sha256:[0-9a-f]{64}$/.test(continuation.inputFingerprint)) {
    throw new QueryVectorValidationError("input fingerprint is malformed");
  }
  const expected = await createInputFingerprint(input, queryVector, digest);
  if (expected !== continuation.inputFingerprint) {
    throw new QueryVectorValidationError(
      "continuation does not match the sanitized search input",
    );
  }
  return queryVector;
}

/**
 * Legacy transient diagnostic. Active RecommendationSearchResult deliberately
 * omits matchedTerms and active continuation scoring uses vector cosine only.
 */
export function semanticSimilarity(
  query: string,
  content: CatalogContent,
): { score: number; matchedTerms: string[] } {
  const queryTokens = tokenize(query);
  const documentTokens = tokenize(contentDocument(content));
  const documentSet = new Set(documentTokens);
  const matchedTerms = queryTokens.filter((term) => documentSet.has(term));
  const overlap =
    queryTokens.length === 0 ? 0 : matchedTerms.length / queryTokens.length;
  const hashedCosine = cosineSimilarity(
    vectorize(queryTokens, LOCAL_QUERY_VECTOR_DIMENSIONS),
    vectorize(documentTokens, LOCAL_QUERY_VECTOR_DIMENSIONS),
  );

  return {
    score: Math.max(0, Math.min(1, hashedCosine * 0.72 + overlap * 0.28)),
    matchedTerms: matchedTerms.slice(0, 6),
  };
}

export function isOpenAiQueryVector(
  vector: QueryVectorSnapshot,
): vector is OpenAiQueryVectorSnapshot {
  return vector.algorithm === OPENAI_QUERY_VECTOR_ALGORITHM;
}
