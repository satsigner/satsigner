import { t } from '@/locales'
import { ScriptVersionTypeSchema } from '@/types/models/Script'

describe('script locale keys', () => {
  it.each(ScriptVersionTypeSchema.options)(
    'has a name and description for %s',
    (scriptVersion) => {
      const prefix = `script.${scriptVersion.toLowerCase()}`
      for (const key of ['name', 'description.1', 'description.2']) {
        expect(t(`${prefix}.${key}`)).not.toMatch(/missing/i)
      }
    }
  )
})
