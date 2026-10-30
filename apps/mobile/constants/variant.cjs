const VARIANT_SUFFIX_MAX_LENGTH = 24

const PACKAGE_ID_DEV = 'com.satsigner.satsigner.dev'
const PACKAGE_ID_PROD = 'com.satsigner.satsigner'

const SCHEME_DEV = 'satsignerdev'
const SCHEME_PROD = 'satsigner'

const APP_NAME_DEV = 'satsigner (Dev)'
const APP_NAME_PROD = 'satsigner'

const APP_VARIANT_PRODUCTION = 'production'

const ANDROID_ABI_ARM64 = 'arm64-v8a'
const ANDROID_ABI_ARMV7 = 'armeabi-v7a'
const ANDROID_ABI_X86 = 'x86'
const ANDROID_ABI_X86_64 = 'x86_64'

const ANDROID_ABIS_DEV = [
  ANDROID_ABI_ARMV7,
  ANDROID_ABI_ARM64,
  ANDROID_ABI_X86,
  ANDROID_ABI_X86_64
]
// Every Android phone runs on ARM. x86 and x86_64 only serve emulators and
// some Chromebooks, so production leaves them out to shrink the APK.
const ANDROID_ABIS_PRODUCTION = [ANDROID_ABI_ARMV7, ANDROID_ABI_ARM64]

function sanitizePackageSegment(raw) {
  const segment = raw
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
    .slice(0, VARIANT_SUFFIX_MAX_LENGTH)

  if (!segment) {
    return ''
  }

  return /^[a-z]/.test(segment) ? segment : `b_${segment}`
}

function sanitizeSchemeSegment(raw) {
  return raw
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, '')
    .slice(0, VARIANT_SUFFIX_MAX_LENGTH)
}

function getVariantPackageId(isDev, rawSuffix) {
  const base = isDev ? PACKAGE_ID_DEV : PACKAGE_ID_PROD
  const segment = sanitizePackageSegment(rawSuffix)

  return segment ? `${base}.${segment}` : base
}

function getVariantAppName(isDev, rawSuffix) {
  const segment = sanitizePackageSegment(rawSuffix)

  if (isDev) {
    return segment ? `${segment} (Dev)` : APP_NAME_DEV
  }

  return segment ? `${segment} (Prod)` : APP_NAME_PROD
}

function getVariantScheme(isDev, rawSuffix) {
  const base = isDev ? SCHEME_DEV : SCHEME_PROD
  const segment = sanitizeSchemeSegment(rawSuffix)

  return segment ? `${base}${segment}` : base
}

function getVariantAndroidAbis(isDev) {
  return isDev ? ANDROID_ABIS_DEV : ANDROID_ABIS_PRODUCTION
}

module.exports = {
  ANDROID_ABI_ARM64,
  ANDROID_ABI_X86_64,
  APP_NAME_DEV,
  APP_NAME_PROD,
  APP_VARIANT_PRODUCTION,
  PACKAGE_ID_DEV,
  PACKAGE_ID_PROD,
  SCHEME_DEV,
  SCHEME_PROD,
  VARIANT_SUFFIX_MAX_LENGTH,
  getVariantAndroidAbis,
  getVariantAppName,
  getVariantPackageId,
  getVariantScheme,
  sanitizePackageSegment,
  sanitizeSchemeSegment
}
