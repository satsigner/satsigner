import z from 'zod'

const HEX_16_BYTES_PATTERN = /^[0-9a-f]{32}$/i
const HEX_12_BYTES_PATTERN = /^[0-9a-f]{24}$/i

/** PBKDF2-SHA256 (10k) + AES-256-CBC. Written by every release before v2. */
const BackupV1Schema = z.object({
  cipher: z.string(),
  iv: z.string(),
  salt: z.string(),
  v: z.literal(1)
})

/** Passphrase KDF recorded in `kdf` + AES-256-GCM with a full 128-bit tag. */
const BackupV2Schema = z.object({
  cipher: z.string(),
  iv: z.string().regex(HEX_12_BYTES_PATTERN),
  kdf: z.string(),
  salt: z.string(),
  tag: z.string().regex(HEX_16_BYTES_PATTERN),
  v: z.literal(2)
})

export const BackupSchema = z.discriminatedUnion('v', [
  BackupV1Schema,
  BackupV2Schema
])

export type BackupV1 = z.infer<typeof BackupV1Schema>
export type BackupV2 = z.infer<typeof BackupV2Schema>

function jsonCodec<T extends z.ZodType>(schema: T) {
  return z.codec(z.string(), schema, {
    decode: (jsonString, ctx) => {
      try {
        return JSON.parse(jsonString)
      } catch (error) {
        ctx.issues.push({
          code: 'invalid_format',
          format: 'json',
          input: jsonString,
          message: error instanceof Error ? error.message : 'Invalid JSON'
        })
        return z.NEVER
      }
    },
    encode: (value) => JSON.stringify(value)
  })
}

export const BackupJsonSchema = jsonCodec(BackupSchema)

/** Reads only the version, so a newer format is told apart from a broken file. */
export const BackupVersionJsonSchema = jsonCodec(
  z.looseObject({ v: z.number() })
)
