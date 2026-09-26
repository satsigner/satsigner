/**
 * Narrows untyped input (parsed JSON, native payloads) to a plain key/value
 * object so its fields can be read and checked one by one. Arrays are
 * rejected.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
