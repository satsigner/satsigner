import {
  APP_NAME_DEV,
  APP_NAME_PROD,
  PACKAGE_ID_DEV,
  PACKAGE_ID_PROD,
  SCHEME_DEV,
  SCHEME_PROD,
  VARIANT_SUFFIX_MAX_LENGTH
} from '@/constants/variant'

export function sanitizePackageSegment(raw: string) {
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

export function sanitizeSchemeSegment(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, VARIANT_SUFFIX_MAX_LENGTH)
}

export function getVariantPackageId(isDev: boolean, rawSuffix: string) {
  const base = isDev ? PACKAGE_ID_DEV : PACKAGE_ID_PROD
  const segment = sanitizePackageSegment(rawSuffix)

  return segment ? `${base}.${segment}` : base
}

export function getVariantAppName(isDev: boolean, rawSuffix: string) {
  const segment = sanitizePackageSegment(rawSuffix)

  if (isDev) {
    return segment ? `${segment} (Dev)` : APP_NAME_DEV
  }

  return segment ? `${segment} (Prod)` : APP_NAME_PROD
}

export function getVariantScheme(isDev: boolean, rawSuffix: string) {
  const base = isDev ? SCHEME_DEV : SCHEME_PROD
  const segment = sanitizeSchemeSegment(rawSuffix)

  return segment ? `${base}${segment}` : base
}
