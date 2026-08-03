import { OTT_PROVIDERS } from "../../contracts/catalog";
import {
  CURATOR_IMAGE_MAX_BYTES,
  CURATOR_IMAGE_MEDIA_TYPES,
  CURATOR_MAX_TURNS,
  CURATOR_MESSAGE_MAX_CODE_POINTS,
  CURATOR_PAGE_CONTEXTS,
  CURATOR_PREFERENCE_SUMMARY_MAX_CODE_POINTS,
  CURATOR_QUICK_REPLY_MAX_CODE_POINTS,
  CURATOR_QUICK_REPLY_MAX_ITEMS,
  CURATOR_REPLY_MAX_CODE_POINTS,
  CURATOR_SEARCH_QUERY_MAX_CODE_POINTS,
  CURATOR_TOPICS,
  type CuratorChoiceDraft,
  type CuratorConversationInterpreter,
  type CuratorImageInput,
  type CuratorModelOutput,
  type CuratorServices,
  type CuratorState,
  type CuratorTopic,
  type CuratorTurnResponse,
  type ResolvedCuratorTurnRequest,
} from "../../contracts/curator";
import {
  CHILD_AGE_RATING_LIMITS,
  COMPANIONS,
  MEDIA_TYPE_PREFERENCES,
  MVP_GENRE_MAX_CODE_POINTS,
  MVP_MOODS,
  ORIGIN_PREFERENCES,
  type ChildAgeRatingLimit,
  type MvpRecommendationRequest,
} from "../../contracts/mvp-search";
import { parseNaturalInput } from "../recommendation/natural-language/parse-natural-input";
import { resolveMvpRecommendationRequest } from "../recommendation/request";

const REQUEST_KEYS = ["pageContext", "message", "image", "state"] as const;
const STATE_KEYS = [
  "turn",
  "resolvedTopics",
  "preferenceSummary",
  "searchQuery",
  "choice",
] as const;
const CHOICE_KEYS = [
  "selectedProviders",
  "companions",
  "moods",
  "desiredGenres",
  "companionAvoidGenres",
  "requiredGenres",
  "excludedGenres",
  "mediaType",
  "naturalRuntimeMinutes",
  "childAgeRatingLimit",
  "originPreference",
] as const;
const IMAGE_KEYS = ["mediaType", "base64"] as const;
const MODEL_OUTPUT_KEYS = [
  "action",
  "reply",
  "questionTopic",
  "quickReplies",
  "resolvedTopics",
  "preferenceSummary",
  "searchQuery",
  "choice",
] as const;

type RecordValue = Record<string, unknown>;

export class CuratorRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CuratorRequestValidationError";
  }
}

export class CuratorModelOutputValidationError extends Error {
  constructor() {
    super("The curator model returned invalid output.");
    this.name = "CuratorModelOutputValidationError";
  }
}

function requestFail(message: string): never {
  throw new CuratorRequestValidationError(message);
}

function modelFail(): never {
  throw new CuratorModelOutputValidationError();
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(
  value: RecordValue,
  expected: readonly string[],
  fail: () => never,
): void {
  const keys = Object.keys(value);
  if (
    keys.length !== expected.length ||
    !expected.every((key) => Object.hasOwn(value, key))
  ) {
    fail();
  }
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function trimCodePoints(value: string, maximum: number): string {
  return Array.from(value).slice(0, maximum).join("");
}

/** Removes common direct identifiers before a model summary is echoed to UI. */
export function sanitizeCuratorText(value: string, maximum: number): string {
  const normalized = value
    .normalize("NFKC")
    .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
    .replace(/(?:\+?82[-\s]?)?0?1[016789][-\s]?\d{3,4}[-\s]?\d{4}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return trimCodePoints(normalized, maximum);
}

export function parseCuratorChildAgeRating(
  text: string,
): ChildAgeRatingLimit | null {
  if (/(전체\s*관람|모든\s*연령|유아|미취학)/.test(text)) return "ALL";
  if (/(7\s*세|일곱\s*살)/.test(text)) return "7";
  if (/(12\s*세|열두\s*살|초등)/.test(text)) return "12";
  if (/(15\s*세|열다섯\s*살|중학생|청소년)/.test(text)) return "15";
  return null;
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value) => right.includes(value))
  );
}

function includesEvery(
  values: readonly string[],
  required: readonly string[],
): boolean {
  return required.every((value) => values.includes(value));
}

function providersAreEquivalent(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const leftIsUnrestricted =
    left.length === 0 || left.length === OTT_PROVIDERS.length;
  const rightIsUnrestricted =
    right.length === 0 || right.length === OTT_PROVIDERS.length;
  return (
    (leftIsUnrestricted && rightIsUnrestricted) || sameSet(left, right)
  );
}

export function hasCuratorMediaRevisionSignal(message: string): boolean {
  const hasMovie = /(영화|무비)/.test(message);
  const hasSeries = /(시리즈|tv\s*쇼|티비\s*쇼)/i.test(message);
  return (
    hasMovie ||
    hasSeries ||
    /(영화|시리즈|작품\s*(?:형식|종류)).*(아무거나|상관없|제한\s*없)/i.test(
      message,
    )
  );
}

/**
 * A model may discover new conditions, but it cannot silently relax a hard
 * condition confirmed in an earlier turn. Explicit current-turn corrections
 * remain possible; genre removals require starting over because the rule
 * parser cannot prove that intent safely.
 */
function validateCuratorTransition(
  request: ResolvedCuratorTurnRequest,
  output: CuratorModelOutput,
): CuratorModelOutput {
  const message = request.message ?? "";
  const parsed = parseNaturalInput(message);
  const previous = request.state.choice;
  const current = output.choice;

  if (parsed.providers.source === "EXPLICIT") {
    if (
      !providersAreEquivalent(
        parsed.providers.value,
        current.selectedProviders,
      )
    ) {
      modelFail();
    }
  } else if (
    previous.selectedProviders.length > 0 &&
    previous.selectedProviders.length < OTT_PROVIDERS.length &&
    !providersAreEquivalent(
      previous.selectedProviders,
      current.selectedProviders,
    )
  ) {
    modelFail();
  }
  if (parsed.runtimeMinutes.source === "EXPLICIT") {
    if (current.naturalRuntimeMinutes !== parsed.runtimeMinutes.value) {
      modelFail();
    }
  } else if (
    previous.naturalRuntimeMinutes !== null &&
    current.naturalRuntimeMinutes !== previous.naturalRuntimeMinutes
  ) {
    modelFail();
  }
  if (parsed.origin.source === "EXPLICIT") {
    if (current.originPreference !== parsed.origin.value) modelFail();
  } else if (
    previous.originPreference !== "ANY" &&
    current.originPreference !== previous.originPreference
  ) {
    modelFail();
  }
  if (hasCuratorMediaRevisionSignal(message)) {
    if (current.mediaType !== parsed.mediaType.value) modelFail();
  } else if (
    previous.mediaType !== "ANY" &&
    current.mediaType !== previous.mediaType
  ) {
    modelFail();
  }
  if (parsed.companion.source === "EXPLICIT") {
    if (current.companions[0] !== parsed.companion.value) modelFail();
  } else if (
    previous.companions[0] !== "ANY" &&
    current.companions[0] !== previous.companions[0]
  ) {
    modelFail();
  }
  if (
    !includesEvery(current.requiredGenres, previous.requiredGenres) ||
    !includesEvery(current.excludedGenres, previous.excludedGenres)
  ) {
    modelFail();
  }
  if (
    (parsed.requiredGenres.source === "EXPLICIT" &&
      !includesEvery(current.requiredGenres, parsed.requiredGenres.value)) ||
    (parsed.excludedGenres.source === "EXPLICIT" &&
      !includesEvery(current.excludedGenres, parsed.excludedGenres.value))
  ) {
    modelFail();
  }
  if (
    previous.companionAvoidGenres.length > 0 &&
    current.companions[0] === previous.companions[0] &&
    !includesEvery(
      current.companionAvoidGenres,
      previous.companionAvoidGenres,
    )
  ) {
    modelFail();
  }

  const explicitRating = parseCuratorChildAgeRating(message);
  if (current.companions[0] === "WITH_CHILDREN") {
    if (
      explicitRating !== null &&
      current.childAgeRatingLimit !== explicitRating
    ) {
      modelFail();
    }
    if (
      explicitRating === null &&
      previous.companions[0] === "WITH_CHILDREN" &&
      previous.childAgeRatingLimit !== null &&
      current.childAgeRatingLimit !== previous.childAgeRatingLimit
    ) {
      modelFail();
    }
    if (
      explicitRating === null &&
      previous.childAgeRatingLimit === null &&
      current.childAgeRatingLimit !== null &&
      !(
        request.state.turn + 1 >= CURATOR_MAX_TURNS &&
        current.childAgeRatingLimit === "ALL"
      )
    ) {
      modelFail();
    }
  }

  return output;
}

function requestString(
  value: unknown,
  field: string,
  maximum: number,
  allowEmpty = true,
): string {
  if (typeof value !== "string") {
    requestFail(`${field} 값은 문자열이어야 합니다.`);
  }
  const normalized = value.normalize("NFKC").trim();
  if (!allowEmpty && !normalized) {
    requestFail(`${field} 값은 비어 있을 수 없습니다.`);
  }
  if (codePointLength(normalized) > maximum) {
    requestFail(`${field} 값은 ${maximum}자를 넘을 수 없습니다.`);
  }
  return normalized;
}

function modelString(value: unknown, maximum: number, allowEmpty = true): string {
  if (typeof value !== "string") modelFail();
  const normalized = sanitizeCuratorText(value, maximum);
  if (!allowEmpty && !normalized) modelFail();
  return normalized;
}

function requestEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value as T[number])) {
    requestFail(`${field} 값이 허용 범위를 벗어났습니다.`);
  }
  return value as T[number];
}

function modelEnum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value as T[number])) {
    modelFail();
  }
  return value as T[number];
}

function requestEnumArray<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
  maximum = allowed.length,
): T[number][] {
  if (!Array.isArray(value) || value.length > maximum) {
    requestFail(`${field} 값은 최대 ${maximum}개의 배열이어야 합니다.`);
  }
  const parsed = value.map((item) => requestEnum(item, allowed, field));
  if (new Set(parsed).size !== parsed.length) {
    requestFail(`${field} 값에는 중복을 넣을 수 없습니다.`);
  }
  return parsed;
}

function modelEnumArray<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  maximum = allowed.length,
): T[number][] {
  if (!Array.isArray(value) || value.length > maximum) modelFail();
  const parsed = value.map((item) => modelEnum(item, allowed));
  if (new Set(parsed).size !== parsed.length) modelFail();
  return parsed;
}

function requestStringArray(
  value: unknown,
  field: string,
  maximumItems: number,
): string[] {
  if (!Array.isArray(value) || value.length > maximumItems) {
    requestFail(`${field} 값은 최대 ${maximumItems}개의 배열이어야 합니다.`);
  }
  const parsed = value.map((item) =>
    requestString(item, field, MVP_GENRE_MAX_CODE_POINTS, false),
  );
  if (new Set(parsed).size !== parsed.length) {
    requestFail(`${field} 값에는 중복을 넣을 수 없습니다.`);
  }
  return parsed;
}

function modelStringArray(
  value: unknown,
  maximumItems: number,
  maximumCodePoints = MVP_GENRE_MAX_CODE_POINTS,
): string[] {
  if (!Array.isArray(value) || value.length > maximumItems) modelFail();
  const parsed = value.map((item) =>
    modelString(item, maximumCodePoints, false),
  );
  if (new Set(parsed).size !== parsed.length) modelFail();
  return parsed;
}

function parseRuntime(value: unknown, fail: () => never): number | null {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 180
  ) {
    fail();
  }
  return value;
}

function validateChoicePolicy(choice: CuratorChoiceDraft, fail: () => never): void {
  const companion = choice.companions[0];
  if (choice.companions.length !== 1) fail();
  if (
    choice.childAgeRatingLimit !== null &&
    companion !== "WITH_CHILDREN"
  ) {
    fail();
  }
  if (
    choice.companionAvoidGenres.length > 0 &&
    companion !== "PARTNER" &&
    companion !== "FRIENDS"
  ) {
    fail();
  }
  if (
    choice.requiredGenres.some((genre) =>
      choice.excludedGenres.includes(genre),
    )
  ) {
    fail();
  }
}

function parseRequestChoice(value: unknown): CuratorChoiceDraft {
  if (!isRecord(value)) requestFail("state.choice 값은 객체여야 합니다.");
  exactKeys(value, CHOICE_KEYS, () =>
    requestFail("state.choice에 알 수 없는 필드가 있습니다."),
  );
  const childAgeRatingLimit =
    value.childAgeRatingLimit === null
      ? null
      : requestEnum(
          value.childAgeRatingLimit,
          CHILD_AGE_RATING_LIMITS,
          "state.choice.childAgeRatingLimit",
        );
  const choice: CuratorChoiceDraft = {
    selectedProviders: requestEnumArray(
      value.selectedProviders,
      OTT_PROVIDERS,
      "state.choice.selectedProviders",
    ),
    companions: requestEnumArray(
      value.companions,
      COMPANIONS,
      "state.choice.companions",
      1,
    ),
    moods: requestEnumArray(
      value.moods,
      MVP_MOODS,
      "state.choice.moods",
      4,
    ),
    desiredGenres: requestStringArray(
      value.desiredGenres,
      "state.choice.desiredGenres",
      8,
    ),
    companionAvoidGenres: requestStringArray(
      value.companionAvoidGenres,
      "state.choice.companionAvoidGenres",
      1,
    ),
    requiredGenres: requestStringArray(
      value.requiredGenres,
      "state.choice.requiredGenres",
      8,
    ),
    excludedGenres: requestStringArray(
      value.excludedGenres,
      "state.choice.excludedGenres",
      8,
    ),
    mediaType: requestEnum(
      value.mediaType,
      MEDIA_TYPE_PREFERENCES,
      "state.choice.mediaType",
    ),
    naturalRuntimeMinutes: parseRuntime(value.naturalRuntimeMinutes, () =>
      requestFail("state.choice.naturalRuntimeMinutes 값이 올바르지 않습니다."),
    ),
    childAgeRatingLimit,
    originPreference: requestEnum(
      value.originPreference,
      ORIGIN_PREFERENCES,
      "state.choice.originPreference",
    ),
  };
  validateChoicePolicy(choice, () =>
    requestFail("state.choice 조건 조합이 안전 정책에 맞지 않습니다."),
  );
  return choice;
}

function parseModelChoice(value: unknown): CuratorChoiceDraft {
  if (!isRecord(value)) modelFail();
  exactKeys(value, CHOICE_KEYS, modelFail);
  const childAgeRatingLimit =
    value.childAgeRatingLimit === null
      ? null
      : modelEnum(value.childAgeRatingLimit, CHILD_AGE_RATING_LIMITS);
  const choice: CuratorChoiceDraft = {
    selectedProviders: modelEnumArray(value.selectedProviders, OTT_PROVIDERS),
    companions: modelEnumArray(value.companions, COMPANIONS, 1),
    moods: modelEnumArray(value.moods, MVP_MOODS, 4),
    desiredGenres: modelStringArray(value.desiredGenres, 8),
    companionAvoidGenres: modelStringArray(value.companionAvoidGenres, 1),
    requiredGenres: modelStringArray(value.requiredGenres, 8),
    excludedGenres: modelStringArray(value.excludedGenres, 8),
    mediaType: modelEnum(value.mediaType, MEDIA_TYPE_PREFERENCES),
    naturalRuntimeMinutes: parseRuntime(value.naturalRuntimeMinutes, modelFail),
    childAgeRatingLimit,
    originPreference: modelEnum(value.originPreference, ORIGIN_PREFERENCES),
  };
  validateChoicePolicy(choice, modelFail);
  return choice;
}

function decodeBase64(value: string): Uint8Array {
  if (
    !value ||
    value.length > Math.ceil(CURATOR_IMAGE_MAX_BYTES / 3) * 4 + 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  ) {
    requestFail("첨부 이미지 데이터가 올바르지 않습니다.");
  }
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    requestFail("첨부 이미지 데이터가 올바르지 않습니다.");
  }
  if (binary.length < 12 || binary.length > CURATOR_IMAGE_MAX_BYTES) {
    requestFail("첨부 이미지는 2MB 이하여야 합니다.");
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function hasImageSignature(
  bytes: Uint8Array,
  mediaType: CuratorImageInput["mediaType"],
): boolean {
  if (mediaType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mediaType === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
      (byte, index) => bytes[index] === byte,
    );
  }
  return (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

const CURATOR_IMAGE_MAX_PIXELS = 40_000_000;
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
  0xcf,
]);

function validImageDimensions(width: number, height: number): boolean {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= 16_384 &&
    height <= 16_384 &&
    width * height <= CURATOR_IMAGE_MAX_PIXELS
  );
}

function pngDimensions(bytes: Uint8Array): [number, number] | null {
  if (
    bytes.length < 45 ||
    String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR" ||
    String.fromCharCode(...bytes.subarray(bytes.length - 8, bytes.length - 4)) !==
      "IEND"
  ) {
    return null;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return [view.getUint32(16), view.getUint32(20)];
}

function jpegDimensions(bytes: Uint8Array): [number, number] | null {
  if (
    bytes.length < 16 ||
    bytes[bytes.length - 2] !== 0xff ||
    bytes[bytes.length - 1] !== 0xd9
  ) {
    return null;
  }
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 1;
      continue;
    }
    if (offset + 2 >= bytes.length) return null;
    const segmentLength = (bytes[offset + 1] << 8) | bytes[offset + 2];
    if (segmentLength < 2 || offset + 1 + segmentLength > bytes.length) {
      return null;
    }
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 7) return null;
      const height = (bytes[offset + 4] << 8) | bytes[offset + 5];
      const width = (bytes[offset + 6] << 8) | bytes[offset + 7];
      return [width, height];
    }
    offset += 1 + segmentLength;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 30) return null;
  const chunk = String.fromCharCode(...bytes.subarray(12, 16));
  if (chunk === "VP8X") {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return [width, height];
  }
  if (
    chunk === "VP8 " &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    return [
      (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    ];
  }
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    const bits =
      bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return [1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff)];
  }
  return null;
}

function hasSafeImageDimensions(
  bytes: Uint8Array,
  mediaType: CuratorImageInput["mediaType"],
): boolean {
  const dimensions =
    mediaType === "image/png"
      ? pngDimensions(bytes)
      : mediaType === "image/jpeg"
        ? jpegDimensions(bytes)
        : webpDimensions(bytes);
  return dimensions !== null && validImageDimensions(...dimensions);
}

function parseImage(value: unknown): CuratorImageInput | null {
  if (value === null) return null;
  if (!isRecord(value)) requestFail("image 값은 객체여야 합니다.");
  exactKeys(value, IMAGE_KEYS, () =>
    requestFail("image에 알 수 없는 필드가 있습니다."),
  );
  const mediaType = requestEnum(
    value.mediaType,
    CURATOR_IMAGE_MEDIA_TYPES,
    "image.mediaType",
  );
  if (typeof value.base64 !== "string") {
    requestFail("image.base64 값은 문자열이어야 합니다.");
  }
  const bytes = decodeBase64(value.base64);
  if (!hasImageSignature(bytes, mediaType)) {
    requestFail("첨부 이미지의 형식과 실제 데이터가 일치하지 않습니다.");
  }
  if (!hasSafeImageDimensions(bytes, mediaType)) {
    requestFail("첨부 이미지의 구조나 해상도가 올바르지 않습니다.");
  }
  return { mediaType, base64: value.base64 };
}

export function resolveCuratorTurnRequest(
  value: unknown,
): ResolvedCuratorTurnRequest {
  if (!isRecord(value)) requestFail("요청 본문은 객체여야 합니다.");
  exactKeys(value, REQUEST_KEYS, () =>
    requestFail("요청에 알 수 없는 필드가 있습니다."),
  );
  if (!isRecord(value.state)) requestFail("state 값은 객체여야 합니다.");
  exactKeys(value.state, STATE_KEYS, () =>
    requestFail("state에 알 수 없는 필드가 있습니다."),
  );
  const turn = value.state.turn;
  if (
    typeof turn !== "number" ||
    !Number.isInteger(turn) ||
    turn < 0 ||
    turn >= CURATOR_MAX_TURNS
  ) {
    requestFail(`대화는 최대 ${CURATOR_MAX_TURNS}턴까지 이어갈 수 있습니다.`);
  }
  const message =
    value.message === null
      ? null
      : requestString(
          value.message,
          "message",
          CURATOR_MESSAGE_MAX_CODE_POINTS,
          false,
        );
  const image = parseImage(value.image);
  if (message === null && image === null) {
    requestFail("메시지나 이미지 중 하나를 보내 주세요.");
  }
  const state: CuratorState = {
    turn,
    resolvedTopics: requestEnumArray(
      value.state.resolvedTopics,
      CURATOR_TOPICS,
      "state.resolvedTopics",
    ),
    preferenceSummary: requestString(
      value.state.preferenceSummary,
      "state.preferenceSummary",
      CURATOR_PREFERENCE_SUMMARY_MAX_CODE_POINTS,
    ),
    searchQuery: requestString(
      value.state.searchQuery,
      "state.searchQuery",
      CURATOR_SEARCH_QUERY_MAX_CODE_POINTS,
    ),
    choice: parseRequestChoice(value.state.choice),
  };
  return {
    pageContext: requestEnum(
      value.pageContext,
      CURATOR_PAGE_CONTEXTS,
      "pageContext",
    ),
    message,
    image,
    state,
  };
}

export function resolveCuratorModelOutput(value: unknown): CuratorModelOutput {
  if (!isRecord(value)) modelFail();
  exactKeys(value, MODEL_OUTPUT_KEYS, modelFail);
  const action = modelEnum(value.action, ["ASK", "READY"] as const);
  const questionTopic =
    value.questionTopic === null
      ? null
      : modelEnum(value.questionTopic, CURATOR_TOPICS);
  const quickReplies = modelStringArray(
    value.quickReplies,
    CURATOR_QUICK_REPLY_MAX_ITEMS,
    CURATOR_QUICK_REPLY_MAX_CODE_POINTS,
  );
  if (
    (action === "ASK" &&
      (questionTopic === null || quickReplies.length < 2)) ||
    (action === "READY" &&
      (questionTopic !== null || quickReplies.length !== 0))
  ) {
    modelFail();
  }
  const searchQuery = modelString(
    value.searchQuery,
    CURATOR_SEARCH_QUERY_MAX_CODE_POINTS,
    action === "READY" ? false : true,
  );
  const choice = parseModelChoice(value.choice);
  if (
    action === "READY" &&
    choice.companions[0] === "WITH_CHILDREN" &&
    choice.childAgeRatingLimit === null
  ) {
    modelFail();
  }
  return {
    action,
    reply: modelString(value.reply, CURATOR_REPLY_MAX_CODE_POINTS, false),
    questionTopic,
    quickReplies,
    resolvedTopics: modelEnumArray(value.resolvedTopics, CURATOR_TOPICS),
    preferenceSummary: modelString(
      value.preferenceSummary,
      CURATOR_PREFERENCE_SUMMARY_MAX_CODE_POINTS,
    ),
    searchQuery,
    choice,
  };
}

function buildHandoff(output: CuratorModelOutput): MvpRecommendationRequest {
  const handoff: MvpRecommendationRequest = {
    choice: {
      selectedProviders: [...output.choice.selectedProviders],
      companions: [...output.choice.companions],
      moods: [...output.choice.moods],
      desiredGenres: [...output.choice.desiredGenres],
      companionAvoidGenres: [...output.choice.companionAvoidGenres],
      requiredGenres: [...output.choice.requiredGenres],
      excludedGenres: [...output.choice.excludedGenres],
      mediaType: output.choice.mediaType,
      naturalRuntimeMinutes: output.choice.naturalRuntimeMinutes,
      childAgeRatingLimit: output.choice.childAgeRatingLimit,
      originPreference: output.choice.originPreference,
      naturalLanguage: output.searchQuery,
      explicitlyRequestedGenres: [...output.choice.desiredGenres],
    },
  };
  resolveMvpRecommendationRequest(handoff, {
    profile: "live",
    requireMeaningfulChoice: true,
  });
  return handoff;
}

function toResponse(
  output: CuratorModelOutput,
  turn: number,
  fallbackUsed: boolean,
): CuratorTurnResponse {
  const state: CuratorState = {
    turn,
    resolvedTopics: [...output.resolvedTopics],
    preferenceSummary: output.preferenceSummary,
    searchQuery: output.searchQuery,
    choice: {
      ...output.choice,
      selectedProviders: [...output.choice.selectedProviders],
      companions: [...output.choice.companions],
      moods: [...output.choice.moods],
      desiredGenres: [...output.choice.desiredGenres],
      companionAvoidGenres: [...output.choice.companionAvoidGenres],
      requiredGenres: [...output.choice.requiredGenres],
      excludedGenres: [...output.choice.excludedGenres],
    },
  };
  return {
    action: output.action,
    reply: output.reply,
    questionTopic: output.questionTopic,
    quickReplies: [...output.quickReplies],
    state,
    handoff: output.action === "READY" ? buildHandoff(output) : null,
    fallbackUsed,
  };
}

export class CuratorConversationService implements CuratorServices {
  constructor(
    private readonly primary: CuratorConversationInterpreter,
    private readonly fallback?: CuratorConversationInterpreter,
  ) {}

  async turn(
    value: unknown,
    signal?: AbortSignal,
  ): Promise<CuratorTurnResponse> {
    const request = resolveCuratorTurnRequest(value);
    const nextTurn = request.state.turn + 1;
    let output: CuratorModelOutput;
    let fallbackUsed = false;
    try {
      output = validateCuratorTransition(
        request,
        resolveCuratorModelOutput(await this.primary.interpret(request, signal)),
      );
    } catch (error) {
      if (signal?.aborted) throw error;
      if (!this.fallback || error instanceof CuratorRequestValidationError) {
        throw error;
      }
      output = validateCuratorTransition(
        request,
        resolveCuratorModelOutput(await this.fallback.interpret(request, signal)),
      );
      fallbackUsed = true;
    }

    if (nextTurn >= CURATOR_MAX_TURNS && output.action === "ASK") {
      if (!this.fallback) throw new CuratorModelOutputValidationError();
      output = validateCuratorTransition(
        request,
        resolveCuratorModelOutput(await this.fallback.interpret(request, signal)),
      );
      fallbackUsed = true;
      if (output.action !== "READY") {
        throw new CuratorModelOutputValidationError();
      }
    }

    return toResponse(output, nextTurn, fallbackUsed);
  }
}

export function addResolvedTopic(
  topics: readonly CuratorTopic[],
  topic: CuratorTopic,
): CuratorTopic[] {
  return topics.includes(topic) ? [...topics] : [...topics, topic];
}
