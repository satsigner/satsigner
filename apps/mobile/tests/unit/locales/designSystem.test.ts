import { DESIGN_FEATURE_IDS } from '@/constants/designSystem'
import { t } from '@/locales'

const ICON_GROUP_KEYS = [
  'navigation',
  'actions',
  'bitcoin',
  'chain',
  'layers',
  'social',
  'views',
  'status',
  'entropy'
]

describe('design system locale keys', () => {
  it.each(DESIGN_FEATURE_IDS)('has a title for the %s feature', (feature) => {
    expect(
      t(`settings.developer.designSystem.features.${feature}`)
    ).not.toMatch(/missing/i)
  })

  it.each(ICON_GROUP_KEYS)('has a title for the %s icon group', (group) => {
    expect(
      t(`settings.developer.designSystem.icons.group.${group}`)
    ).not.toMatch(/missing/i)
  })

  it('keeps the existing design entry label', () => {
    expect(t('settings.developer.design')).toBe('Design')
  })
})
