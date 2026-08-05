import Constants from 'expo-constants'

import {
  PACKAGE_ID_DEV,
  PACKAGE_ID_PROD,
  sanitizePackageSegment
} from '@/constants/variant'

/**
 * Mirror APK naming from `pnpm variant -- --apk`:
 * `satsigner-<dev|prod>-<suffix|plain>-…`
 */
function getBackupVariantLabels(packageId = ''): {
  suffixLabel: string
  variantLabel: 'dev' | 'prod'
} {
  if (packageId === PACKAGE_ID_DEV) {
    return { suffixLabel: 'plain', variantLabel: 'dev' }
  }
  if (packageId.startsWith(`${PACKAGE_ID_DEV}.`)) {
    const suffix = packageId.slice(PACKAGE_ID_DEV.length + 1)
    return {
      suffixLabel: sanitizePackageSegment(suffix) || 'plain',
      variantLabel: 'dev'
    }
  }
  if (packageId === PACKAGE_ID_PROD) {
    return { suffixLabel: 'plain', variantLabel: 'prod' }
  }
  if (packageId.startsWith(`${PACKAGE_ID_PROD}.`)) {
    const suffix = packageId.slice(PACKAGE_ID_PROD.length + 1)
    return {
      suffixLabel: sanitizePackageSegment(suffix) || 'plain',
      variantLabel: 'prod'
    }
  }
  return { suffixLabel: 'plain', variantLabel: 'dev' }
}

function getBackupFilename(now = Date.now()): string {
  const packageId =
    Constants.expoConfig?.android?.package ??
    Constants.expoConfig?.ios?.bundleIdentifier ??
    ''
  const { suffixLabel, variantLabel } = getBackupVariantLabels(packageId)
  return `satsigner-backup-${variantLabel}-${suffixLabel}-${now}.json`
}

export { getBackupFilename, getBackupVariantLabels }
