import z from 'zod'

export const ScriptVersionTypeSchema = z.enum([
  'P2PKH',
  'P2SH-P2WPKH',
  'P2WPKH',
  'P2TR',
  'P2WSH',
  'P2SH-P2WSH',
  'P2SH'
])

export type ScriptVersionType = z.infer<typeof ScriptVersionTypeSchema>
