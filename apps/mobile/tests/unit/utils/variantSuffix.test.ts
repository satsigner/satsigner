import {
  APP_NAME_DEV,
  PACKAGE_ID_DEV,
  PACKAGE_ID_PROD,
  SCHEME_DEV
} from '@/constants/variant'
import {
  getVariantAndroidAbis,
  getVariantAppName,
  getVariantIcons,
  getVariantPackageId,
  getVariantScheme,
  sanitizePackageSegment,
  sanitizeSchemeSegment
} from '@/utils/variantSuffix'

describe('variantSuffix utils', () => {
  describe('sanitizePackageSegment', () => {
    it('sanitizes branch names into package segments', () => {
      expect(sanitizePackageSegment('feat/privacy-algo')).toBe(
        'feat_privacy_algo'
      )
    })

    it('prefixes segments that start with a digit', () => {
      expect(sanitizePackageSegment('453-feature')).toBe('b_453_feature')
    })

    it('returns an empty string for blank input', () => {
      expect(sanitizePackageSegment('   ')).toBe('')
    })
  })

  describe('sanitizeSchemeSegment', () => {
    it('strips non-alphanumeric characters for URL schemes', () => {
      expect(sanitizeSchemeSegment('feat/privacy-algo')).toBe('featprivacyalgo')
    })
  })

  describe('getVariantPackageId', () => {
    it('returns the default dev package id without a suffix', () => {
      expect(getVariantPackageId(true, '')).toBe(PACKAGE_ID_DEV)
    })

    it('appends a sanitized suffix to the dev package id', () => {
      expect(getVariantPackageId(true, 'pr453')).toBe(`${PACKAGE_ID_DEV}.pr453`)
    })

    it('appends a sanitized suffix to the prod package id', () => {
      expect(getVariantPackageId(false, 'pr453')).toBe(
        `${PACKAGE_ID_PROD}.pr453`
      )
    })
  })

  describe('getVariantAppName', () => {
    it('returns the default dev app name without a suffix', () => {
      expect(getVariantAppName(true, '')).toBe(APP_NAME_DEV)
    })

    it('puts the suffix first for launcher differentiation', () => {
      expect(getVariantAppName(true, 'feat/privacy-algo')).toBe(
        'DEV feat_privacy_algo'
      )
    })
  })

  describe('getVariantScheme', () => {
    it('returns the default dev scheme without a suffix', () => {
      expect(getVariantScheme(true, '')).toBe(SCHEME_DEV)
    })

    it('appends a sanitized scheme segment', () => {
      expect(getVariantScheme(true, 'pr453')).toBe(`${SCHEME_DEV}pr453`)
    })
  })

  describe('getVariantAndroidAbis', () => {
    it('builds every CPU type for dev so emulators keep working', () => {
      expect(getVariantAndroidAbis(true)).toStrictEqual([
        'armeabi-v7a',
        'arm64-v8a',
        'x86',
        'x86_64'
      ])
    })

    it('ships only ARM CPU types in production', () => {
      expect(getVariantAndroidAbis(false)).toStrictEqual([
        'armeabi-v7a',
        'arm64-v8a'
      ])
    })
  })

  describe('getVariantIcons', () => {
    it('uses the plain icon for production', () => {
      expect(getVariantIcons(false, 'feat/x').icon).toBe('./assets/icon.png')
    })

    it('marks the generic dev build with the dev icon', () => {
      expect(getVariantIcons(true, '').adaptiveForeground).toBe(
        './assets/adaptive-icon-badge-dev.png'
      )
    })

    it('marks branch builds with the branch icon', () => {
      expect(getVariantIcons(true, 'feat/x').adaptiveForeground).toBe(
        './assets/adaptive-icon-badge-branch.png'
      )
    })
  })
})
