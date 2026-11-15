import { SCRIPT_DIAGRAMS } from '@/constants/scriptDiagrams'
import { t } from '@/locales'
import {
  ScriptVersionTypeSchema,
  type ScriptVersionType
} from '@/types/models/Script'

const MULTISIG_WITNESS_SCRIPTS: ScriptVersionType[] = ['P2WSH', 'P2SH-P2WSH']

describe('script locale keys', () => {
  it.each(ScriptVersionTypeSchema.options)(
    'has a name and description for %s',
    (scriptVersion) => {
      const prefix = `script.${scriptVersion.toLowerCase()}`
      for (const key of ['name', 'description']) {
        expect(t(`${prefix}.${key}`)).not.toMatch(/missing/i)
      }
    }
  )

  it.each(ScriptVersionTypeSchema.options)(
    'has a locking script and translated diagram labels for %s',
    (scriptVersion) => {
      const rows = SCRIPT_DIAGRAMS[scriptVersion]
      expect(rows[0].label).toBe('scriptPubKey')
      const dataKeys = rows.flatMap((row) =>
        row.items
          .filter((item) => item.kind === 'data')
          .map((item) => `script.diagram.data.${item.value}`)
      )
      const labelKeys = rows.map((row) => `script.diagram.${row.label}`)
      for (const key of [...labelKeys, ...dataKeys]) {
        expect(t(key)).not.toMatch(/missing/i)
      }
    }
  )

  it.each(MULTISIG_WITNESS_SCRIPTS)(
    'starts the %s multisig witness with the empty CHECKMULTISIG element',
    (scriptVersion) => {
      const witness = SCRIPT_DIAGRAMS[scriptVersion].find(
        (row) => row.label === 'witness'
      )
      expect(witness?.items[0]).toStrictEqual({
        kind: 'data',
        value: 'emptyElement'
      })
    }
  )
})
