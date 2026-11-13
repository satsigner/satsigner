import { t } from '@/locales'
import { CONTENT_TYPES } from '@/utils/contentDetector'

describe('paste locale keys', () => {
  it.each(CONTENT_TYPES)('has a validation message for %s', (contentType) => {
    expect(t(`paste.validation.${contentType}`)).not.toMatch(/missing/i)
  })

  it('falls back to the generic message for an unknown key', () => {
    expect(
      t('paste.validation.not_a_content_type', {
        defaults: [{ scope: 'paste.validation.valid' }]
      })
    ).toBe(t('paste.validation.valid'))
  })
})
