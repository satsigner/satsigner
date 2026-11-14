import { SCRIPT_DIAGRAMS } from '@/constants/scriptDiagrams'
import { t } from '@/locales'
import { ScriptVersionTypeSchema } from '@/types/models/Script'

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
})
