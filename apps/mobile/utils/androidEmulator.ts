export type AndroidBuildInfo = {
  Brand?: string
  Fingerprint?: string
  Manufacturer?: string
  Model?: string
}

const EMULATOR_MODEL_MARKERS = [
  'Android SDK built for',
  'Emulator',
  'google_sdk',
  'sdk_gphone'
]

/**
 * Whether Android build properties describe an emulator. Reads React Native's
 * own Platform.constants instead of a device-info library, so no Google Play
 * dependency is needed for it.
 */
export function isAndroidEmulatorBuild(info: AndroidBuildInfo): boolean {
  const fingerprint = info.Fingerprint ?? ''
  const model = info.Model ?? ''
  if (fingerprint.startsWith('generic') || fingerprint.includes('emulator')) {
    return true
  }
  if (EMULATOR_MODEL_MARKERS.some((marker) => model.includes(marker))) {
    return true
  }
  return (
    (info.Manufacturer ?? '').includes('Genymotion') ||
    ((info.Brand ?? '').startsWith('generic') &&
      fingerprint.includes('generic'))
  )
}
