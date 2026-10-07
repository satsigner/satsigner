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

/** Script type of a multisig policy, as derived from a key's script version. */
export type MultisigScriptType = Extract<
  ScriptVersionType,
  'P2SH' | 'P2SH-P2WSH' | 'P2WSH' | 'P2TR'
>
