import z from 'zod'

export const BackupSchema = z.object({
  cipher: z.string(),
  iv: z.string(),
  salt: z.string(),
  v: z.number()
})

export const BackupJsonSchema = z.codec(z.string(), BackupSchema, {
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

export type Backup = z.infer<typeof BackupSchema>