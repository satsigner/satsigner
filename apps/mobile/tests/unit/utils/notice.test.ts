import { t } from '@/locales'
import { formatMessage } from '@/utils/notice'

describe('formatMessage', () => {
  it('translates i18n keys with their params', () => {
    expect(formatMessage({ key: 'common.loading' })).toBe(t('common.loading'))
    expect(
      formatMessage({
        key: 'transaction.preview.enterSeedWordsHint',
        params: { count: 12 }
      })
    ).toBe(t('transaction.preview.enterSeedWordsHint', { count: 12 }))
  })

  it('returns plain text as is', () => {
    expect(formatMessage({ text: 'Insufficient funds' })).toBe(
      'Insufficient funds'
    )
  })
})
