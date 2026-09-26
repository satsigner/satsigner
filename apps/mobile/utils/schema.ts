import { z } from 'zod'

/**
 * Required field of an untrusted payload: keeps a value `schema` accepts and
 * yields `fallback` for anything else, a missing key included, so one
 * unreadable field never rejects the whole object.
 */
export function withFallback<T extends z.ZodType>(
  schema: T,
  fallback: z.input<T>
) {
  return z.preprocess(
    (value) => (schema.safeParse(value).success ? value : fallback),
    schema
  )
}

/**
 * Optional field of an untrusted payload: keeps a value `schema` accepts and
 * drops anything else, null included, instead of rejecting the whole object.
 */
export function optionalLenient<T extends z.ZodType>(schema: T) {
  return z.union([schema, z.unknown().transform(() => undefined)]).optional()
}
