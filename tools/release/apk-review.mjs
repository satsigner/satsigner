import {
  ANDROID_ABI_ARM64 as ZAPSTORE_ABI,
  ANDROID_ABI_LABELS
} from '../../apps/mobile/constants/variant.cjs'

const ANDROID_PERMISSION = 'android.permission.'
const DEBUG_CERT_NAME = 'CN=Android Debug'
// <uses-permission-sdk-23> grants the same access on Android 6 and later, and
// Expo's blockedPermissions does not strip it.
const PERMISSION_LINE = /^uses-permission(-sdk-23)?:/
// variant.ts names builds satsigner-<label>-<segment>-<buildType>[-<abi>].apk,
// so a debug build from a branch named `release` also ends in -release-debug.
const RELEASE_APK_SUFFIXES = [
  '-release.apk',
  ...[...ANDROID_ABI_LABELS.values()].map((abi) => `-release-${abi}.apk`)
]
// apksigner prints the optional Source Stamp signer next to the APK signers.
// It does not sign the APK, so it never counts as a signing identity.
const SOURCE_STAMP_SIGNER = /source stamp/i
const VERSION_CODE_LABEL = 'Version code is higher than the published one'
const CERTIFICATE_LABEL =
  "Certificate is the app's current one or linked by lineage"

const PERMISSION_GROUPS = [
  { id: 'camera', label: 'Camera', permissions: ['CAMERA'] },
  {
    id: 'gallery',
    label: 'Photos and files',
    permissions: [
      'READ_MEDIA_IMAGES',
      'READ_MEDIA_VIDEO',
      'READ_MEDIA_VISUAL_USER_SELECTED',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'MANAGE_EXTERNAL_STORAGE',
      'ACCESS_MEDIA_LOCATION'
    ]
  },
  { id: 'microphone', label: 'Microphone', permissions: ['RECORD_AUDIO'] },
  {
    id: 'location',
    label: 'Location',
    permissions: [
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION'
    ]
  },
  {
    id: 'personal',
    label: 'Contacts, calls and SMS',
    permissions: [
      'READ_CONTACTS',
      'READ_CALL_LOG',
      'READ_PHONE_STATE',
      'READ_SMS',
      'SEND_SMS'
    ]
  },
  {
    id: 'system',
    label: 'Other apps and overlays',
    permissions: [
      'SYSTEM_ALERT_WINDOW',
      'QUERY_ALL_PACKAGES',
      'REQUEST_INSTALL_PACKAGES'
    ]
  },
  {
    id: 'ads',
    label: 'Advertising and install tracking',
    permissions: [
      'com.google.android.gms.permission.AD_ID',
      'com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE'
    ]
  }
]

// Class prefixes from the Exodus Privacy tracker signatures, as they appear
// in dex type descriptors.
const TRACKERS = [
  ['Google AdMob', 'Lcom/google/android/gms/ads/'],
  ['Google Analytics', 'Lcom/google/android/gms/analytics/'],
  ['Google Firebase Analytics', 'Lcom/google/firebase/analytics/'],
  ['Google CrashLytics', 'Lcom/google/firebase/crashlytics/'],
  ['Google CrashLytics', 'Lcom/crashlytics/'],
  ['Facebook Analytics', 'Lcom/facebook/appevents/'],
  ['Facebook Login', 'Lcom/facebook/login/'],
  ['Mixpanel', 'Lcom/mixpanel/'],
  ['Amplitude', 'Lcom/amplitude/'],
  ['AppsFlyer', 'Lcom/appsflyer/'],
  ['Adjust', 'Lcom/adjust/sdk/'],
  ['Branch', 'Lio/branch/'],
  ['OneSignal', 'Lcom/onesignal/'],
  ['Segment', 'Lcom/segment/analytics/'],
  ['Bugsnag', 'Lcom/bugsnag/'],
  ['Sentry', 'Lio/sentry/']
]

function quoted(line, key) {
  return line.match(new RegExp(`${key}='([^']*)'`))?.[1]
}

function parseBadging(text) {
  const lines = text.split('\n')
  const packageLine = lines.find((line) => line.startsWith('package:')) ?? ''
  const lineValue = (prefix) =>
    lines.find((line) => line.startsWith(prefix))?.slice(prefix.length)
  const nativeCode = lineValue('native-code:') ?? ''
  // aapt2 from build-tools 35 on prints minSdkVersion:, older ones sdkVersion:.
  const minSdk = lineValue('minSdkVersion:') ?? lineValue('sdkVersion:')
  return {
    abis: [...nativeCode.matchAll(/'([^']+)'/g)].map((match) => match[1]),
    label: lineValue('application-label:')?.replaceAll("'", '') ?? '',
    minSdk: Number(minSdk?.replaceAll("'", '')),
    packageId: quoted(packageLine, 'name') ?? '',
    targetSdk: Number(lineValue('targetSdkVersion:')?.replaceAll("'", '')),
    versionCode: Number(quoted(packageLine, 'versionCode')),
    versionName: quoted(packageLine, 'versionName') ?? ''
  }
}

function parsePermissions(text) {
  return text.split('\n').flatMap((line) => {
    if (!PERMISSION_LINE.test(line)) {
      return []
    }
    const name = quoted(line, 'name')
    if (!name) {
      return []
    }
    const maxSdk = quoted(line, 'maxSdkVersion')
    return [{ maxSdk: maxSdk ? Number(maxSdk) : undefined, name }]
  })
}

function isReleaseApkName(name) {
  return RELEASE_APK_SUFFIXES.some((suffix) => name.endsWith(suffix))
}

function parseSigners(text) {
  const signers = new Map()
  for (const line of text.split('\n')) {
    const match = line.match(
      /^(.*?Signer.*?):? certificate (SHA-256 digest|DN): (.+)$/
    )
    if (!match || SOURCE_STAMP_SIGNER.test(match[1])) {
      continue
    }
    const [, signer, field, value] = match
    const entry = signers.get(signer) ?? { signer }
    if (field === 'DN') {
      entry.name = value.trim()
    } else {
      entry.sha256 = value.trim().toLowerCase()
    }
    signers.set(signer, entry)
  }
  return [...signers.values()]
}

function fullPermissionName(name) {
  return name.includes('.') ? name : `${ANDROID_PERMISSION}${name}`
}

function permissionGroups(permissions) {
  return PERMISSION_GROUPS.map((group) => {
    const wanted = new Set(group.permissions.map(fullPermissionName))
    const requested = permissions.filter((permission) =>
      wanted.has(permission.name)
    )
    return { id: group.id, label: group.label, requested }
  })
}

function findTrackers(dex) {
  const names = TRACKERS.filter(([, prefix]) => dex.includes(prefix)).map(
    ([name]) => name
  )
  return [...new Set(names)]
}

function fingerprintHex(fingerprint) {
  return fingerprint.replaceAll(':', '').toLowerCase()
}

function check(id, label, ok, detail, failStatus = 'fail') {
  return { detail, id, label, status: ok ? 'pass' : failStatus }
}

function signerChecks({ releaseFingerprint, signers }) {
  const hashes = signers.map((signer) => signer.sha256)
  const debug = signers.some((signer) => signer.name?.includes(DEBUG_CERT_NAME))
  const releaseHash = fingerprintHex(releaseFingerprint)
  return [
    check(
      'debug-key',
      'Not signed with the debug key',
      !debug && hashes.length > 0,
      hashes.length ? 'Signed with a release key' : 'The APK is not signed'
    ),
    check(
      'release-key',
      'Signed with the Satsigner release key',
      hashes.includes(releaseHash),
      hashes.join(', ') || 'No certificate'
    )
  ]
}

// Without an answer from the relay neither check can pass: a timeout must not
// read as "nothing published yet".
function unansweredChecks(liveError) {
  const detail = `Could not ask Zapstore: ${liveError}`
  return [
    { detail, id: 'version-code', label: VERSION_CODE_LABEL, status: 'warn' },
    { detail, id: 'certificate', label: CERTIFICATE_LABEL, status: 'warn' }
  ]
}

function publishedChecks({ apk, live, liveError }) {
  if (liveError) {
    return unansweredChecks(liveError)
  }
  if (!live) {
    return [
      check(
        'version-code',
        VERSION_CODE_LABEL,
        true,
        `${apk.versionCode}, nothing published yet`
      )
    ]
  }
  const hashes = apk.signers.map((signer) => signer.sha256)
  return [
    check(
      'version-code',
      VERSION_CODE_LABEL,
      apk.versionCode > live.versionCode,
      `${apk.versionCode} here, ${live.versionCode} on Zapstore (${live.versionName})`
    ),
    check(
      'certificate',
      CERTIFICATE_LABEL,
      hashes.includes(live.certificateHash),
      `Zapstore has ${live.certificateHash}`
    )
  ]
}

function zapstoreChecks({
  apk,
  expectedPackageId,
  live,
  liveError,
  listing,
  releaseFingerprint
}) {
  const nativeOk = apk.abis.length === 0 || apk.abis.includes(ZAPSTORE_ABI)
  return [
    check(
      'package',
      'Package id matches the channel',
      apk.packageId === expectedPackageId,
      `${apk.packageId} (expected ${expectedPackageId})`
    ),
    check(
      'abi',
      `Contains a complete ${ZAPSTORE_ABI} build`,
      nativeOk,
      apk.abis.join(', ') || 'No native code'
    ),
    ...publishedChecks({ apk, live, liveError }),
    ...signerChecks({ releaseFingerprint, signers: apk.signers }),
    check(
      'summary',
      'Listing has a summary',
      listing.summary.length > 0,
      `${listing.summary.length} characters`
    ),
    check(
      'description',
      'Listing has a description',
      listing.description.length > 0,
      `${listing.description.length} characters`
    ),
    check(
      'screenshots',
      'Listing has screenshots',
      listing.images.length > 0,
      `${listing.images.length} screenshots`
    )
  ]
}

function permissionText({ maxSdk, name }) {
  return maxSdk ? `${name} (up to API ${maxSdk})` : name
}

function groupStatus(requested) {
  if (requested.length === 0) {
    return 'pass'
  }
  return requested.every((permission) => permission.status === 'allowed')
    ? 'warn'
    : 'fail'
}

// In the APK a blocked permission is a failure too: the block did not apply.
function notAllowed(permissions) {
  return permissions.filter((permission) => permission.status !== 'allowed')
}

function securityChecks({ permissions, trackers }) {
  const extra = notAllowed(permissions)
  const groups = permissionGroups(permissions).map((group) => ({
    detail: group.requested.map(permissionText).join(', ') || 'Not requested',
    id: `permission-${group.id}`,
    label: group.label,
    status: groupStatus(group.requested)
  }))
  return [
    check(
      'allowlist',
      'Only allowed permissions',
      extra.length === 0,
      extra.map(permissionText).join(', ') || 'All on the allow list'
    ),
    ...groups,
    check(
      'trackers',
      'No known tracker libraries',
      trackers.length === 0,
      trackers.join(', ') || 'None found',
      'warn'
    )
  ]
}

const LIBRARY_STATUS = {
  allowed: { detail: 'Allowed', status: 'pass' },
  blocked: { detail: 'Blocked, stripped from the build', status: 'pass' },
  unexpected: { detail: 'Neither allowed nor blocked', status: 'fail' }
}

function libraryChecks(libraries) {
  const byName = Map.groupBy(libraries, (permission) => permission.name)
  return [...byName].map(([name, entries]) => {
    const { detail, status } = LIBRARY_STATUS[entries[0].status]
    const from = [...new Set(entries.map((entry) => entry.library))]
    return {
      detail: `${detail} · ${from.join(', ')}`,
      id: `library-${name}`,
      label: name,
      status
    }
  })
}

function latestAsset(events) {
  const assets = events
    .map((event) => {
      const tag = (name) => event.tags.find((entry) => entry[0] === name)?.[1]
      return {
        certificateHash: tag('apk_certificate_hash')?.toLowerCase() ?? '',
        versionCode: Number(tag('version_code')),
        versionName: tag('version') ?? ''
      }
    })
    .filter((asset) => Number.isFinite(asset.versionCode))
  return assets.toSorted((a, b) => b.versionCode - a.versionCode)[0]
}

export {
  findTrackers,
  isReleaseApkName,
  latestAsset,
  libraryChecks,
  notAllowed,
  parseBadging,
  parsePermissions,
  parseSigners,
  permissionText,
  securityChecks,
  zapstoreChecks
}
