import { t } from '@/locales'

describe('auth locale keys', () => {
  it('pluralizes the tries left message', () => {
    expect(t('auth.triesLeft', { count: 1 })).toBe('1 try left')
    expect(t('auth.triesLeft', { count: 3 })).toBe('3 tries left')
  })
})
