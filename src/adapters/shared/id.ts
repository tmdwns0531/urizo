let sequence = 0;

export function createId(prefix: string): string {
  sequence += 1;
  const random =
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${sequence.toString(36)}`;
  return `${prefix}_${random}`;
}
