const VARIANT_SUFFIX_MAX_LENGTH = 24

const PACKAGE_ID_DEV = 'com.satsigner.satsigner.dev'
const PACKAGE_ID_PROD = 'com.satsigner.satsigner'

const SCHEME_DEV = 'satsignerdev'
const SCHEME_PROD = 'satsigner'

const APP_NAME_DEV = 'satsigner (Dev)'
const APP_NAME_PROD = 'satsigner'

const APP_VARIANT_PRODUCTION = 'production'

function sanitizePackageSegment(raw) {
  const segment = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, VARIANT_SUFFIX_MAX_LENGTH)

  if (!segment) {
    return ''
  }

  return /^[a-z]/.test(segment) ? segment : `b_${segment}`
}

function sanitizeSchemeSegment(raw) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
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

module.exports = {
  APP_NAME_DEV,
  APP_NAME_PROD,
  APP_VARIANT_PRODUCTION,
  PACKAGE_ID_DEV,
  PACKAGE_ID_PROD,
  SCHEME_DEV,
  SCHEME_PROD,
  VARIANT_SUFFIX_MAX_LENGTH,
  getVariantAppName,
  getVariantPackageId,
  getVariantScheme,
  sanitizePackageSegment,
  sanitizeSchemeSegment
}
