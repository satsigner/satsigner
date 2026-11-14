import assert from 'node:assert/strict'
import test from 'node:test'

import {
  findTrackers,
  isReleaseApkName,
  latestAsset,
  libraryChecks,
  parseBadging,
  parsePermissions,
  parseSigners,
  securityChecks,
  zapstoreChecks
} from './apk-review.mjs'

const RELEASE_FINGERPRINT = 'AA:BB'
const RELEASE_HASH = 'aabb'

const BADGING = `package: name='com.example' versionCode='7' versionName='1.2.0' platformBuildVersionName='17'
minSdkVersion:'24'
targetSdkVersion:'36'
application-label:'Example'
native-code: 'arm64-v8a'`

const PERMISSIONS = `package: com.example
uses-permission: name='android.permission.CAMERA'
uses-permission: name='android.permission.READ_EXTERNAL_STORAGE' maxSdkVersion='32'
uses-permission: name='android.permission.INTERNET'
uses-permission-sdk-23: name='android.permission.ACCESS_FINE_LOCATION'
permission: com.example.DYNAMIC`

const SIGNERS = `Verified using v2 scheme (APK Signature Scheme v2): true
Signer #1 certificate DN: CN=Satsigner release
Signer #1 certificate SHA-256 digest: AABB
V3.1 Signer: (minSdkVersion=33) certificate DN: CN=Next
V3.1 Signer: (minSdkVersion=33) certificate SHA-256 digest: ccdd`

const LISTING = { description: 'About', images: ['a.png'], summary: 'Short' }

function apk(overrides = {}) {
  return {
    ...parseBadging(BADGING),
    permissions: parsePermissions(PERMISSIONS),
    signers: parseSigners(SIGNERS),
    trackers: [],
    ...overrides
  }
}

function statusOf(checks, id) {
  return checks.find((item) => item.id === id).status
}

test('reads the package, version, sdk levels and abis from badging', () => {
  assert.deepEqual(parseBadging(BADGING), {
    abis: ['arm64-v8a'],
    label: 'Example',
    minSdk: 24,
    packageId: 'com.example',
    targetSdk: 36,
    versionCode: 7,
    versionName: '1.2.0'
  })
})

test('reads the min sdk from aapt2 before build-tools 35 too', () => {
  const older = BADGING.replace("minSdkVersion:'24'", "sdkVersion:'23'")
  assert.equal(parseBadging(older).minSdk, 23)
})

test('reads requested permissions with their sdk cap', () => {
  assert.deepEqual(parsePermissions(PERMISSIONS), [
    { maxSdk: undefined, name: 'android.permission.CAMERA' },
    { maxSdk: 32, name: 'android.permission.READ_EXTERNAL_STORAGE' },
    { maxSdk: undefined, name: 'android.permission.INTERNET' },
    { maxSdk: undefined, name: 'android.permission.ACCESS_FINE_LOCATION' }
  ])
})

test('reads every signer certificate, rotated ones included', () => {
  assert.deepEqual(
    parseSigners(SIGNERS).map((signer) => signer.sha256),
    ['aabb', 'ccdd']
  )
})

function withStatus(statuses) {
  return parsePermissions(PERMISSIONS).map((permission) => ({
    ...permission,
    status: statuses[permission.name] ?? 'allowed'
  }))
}

test('shows allowed camera access for review and absent microphone as ok', () => {
  const checks = securityChecks({ permissions: withStatus({}), trackers: [] })
  assert.equal(statusOf(checks, 'allowlist'), 'pass')
  assert.equal(statusOf(checks, 'permission-camera'), 'warn')
  assert.equal(statusOf(checks, 'permission-microphone'), 'pass')
})

test('fails a permission that is blocked or not on the allow list', () => {
  const checks = securityChecks({
    permissions: withStatus({
      'android.permission.READ_EXTERNAL_STORAGE': 'blocked'
    }),
    trackers: []
  })
  assert.equal(statusOf(checks, 'allowlist'), 'fail')
  assert.equal(statusOf(checks, 'permission-gallery'), 'fail')
})

test('before a build, only a permission neither allowed nor blocked fails', () => {
  const checks = libraryChecks([
    { library: 'a', name: 'CAMERA', status: 'allowed' },
    { library: 'b', name: 'WAKE_LOCK', status: 'blocked' },
    { library: 'c', name: 'READ_SMS', status: 'unexpected' },
    { library: 'd', name: 'CAMERA', status: 'allowed' }
  ])
  assert.deepEqual(
    checks.map(({ label, status }) => [label, status]),
    [
      ['CAMERA', 'pass'],
      ['WAKE_LOCK', 'pass'],
      ['READ_SMS', 'fail']
    ]
  )
  assert.match(checks[0].detail, /a, d/)
})

test('finds tracker libraries by their class prefix', () => {
  const dex = Buffer.from('xxLcom/mixpanel/android/Foo;xxLio/sentry/Bar;')
  assert.deepEqual(findTrackers(dex), ['Mixpanel', 'Sentry'])
  assert.deepEqual(findTrackers(Buffer.from('Lcom/example/App;')), [])
})

test('passes a release that matches what zapstore expects', () => {
  const checks = zapstoreChecks({
    apk: apk(),
    expectedPackageId: 'com.example',
    listing: LISTING,
    live: { certificateHash: RELEASE_HASH, versionCode: 6 },
    releaseFingerprint: RELEASE_FINGERPRINT
  })
  assert.ok(checks.every((item) => item.status === 'pass'))
})

test('fails a version code that is not higher than the published one', () => {
  const checks = zapstoreChecks({
    apk: apk(),
    expectedPackageId: 'com.example',
    listing: LISTING,
    live: { certificateHash: RELEASE_HASH, versionCode: 7 },
    releaseFingerprint: RELEASE_FINGERPRINT
  })
  assert.equal(statusOf(checks, 'version-code'), 'fail')
})

test('fails a certificate that zapstore does not know', () => {
  const checks = zapstoreChecks({
    apk: apk(),
    expectedPackageId: 'com.example',
    listing: LISTING,
    live: { certificateHash: 'eeff', versionCode: 1 },
    releaseFingerprint: RELEASE_FINGERPRINT
  })
  assert.equal(statusOf(checks, 'certificate'), 'fail')
})

test('warns instead of passing when zapstore did not answer', () => {
  const checks = zapstoreChecks({
    apk: apk(),
    expectedPackageId: 'com.example',
    listing: LISTING,
    live: undefined,
    liveError: 'wss://relay.zapstore.dev did not answer',
    releaseFingerprint: RELEASE_FINGERPRINT
  })
  assert.equal(statusOf(checks, 'version-code'), 'warn')
  assert.equal(statusOf(checks, 'certificate'), 'warn')
})

test('fails the debug key, a missing arm64 build and an empty listing', () => {
  const checks = zapstoreChecks({
    apk: apk({
      abis: ['x86_64'],
      signers: [{ name: 'CN=Android Debug,O=Android', sha256: 'ffff' }]
    }),
    expectedPackageId: 'com.example',
    listing: { description: '', images: [], summary: '' },
    live: undefined,
    releaseFingerprint: RELEASE_FINGERPRINT
  })
  for (const id of [
    'abi',
    'debug-key',
    'release-key',
    'summary',
    'description',
    'screenshots'
  ]) {
    assert.equal(statusOf(checks, id), 'fail', id)
  }
})

test('picks the highest published version code', () => {
  const event = (code, cert) => ({
    tags: [
      ['version_code', String(code)],
      ['version', `v${code}`],
      ['apk_certificate_hash', cert]
    ]
  })
  assert.deepEqual(latestAsset([event(2, 'AA'), event(5, 'BB')]), {
    certificateHash: 'bb',
    versionCode: 5,
    versionName: 'v5'
  })
  assert.equal(latestAsset([]), undefined)
})

test('matches release apks and skips a debug build from a branch named release', () => {
  assert.equal(isReleaseApkName('satsigner-prod-release.apk'), true)
  assert.equal(isReleaseApkName('satsigner-dev-main-release-arm64.apk'), true)
  assert.equal(isReleaseApkName('satsigner-dev-release-debug.apk'), false)
  assert.equal(isReleaseApkName('satsigner-dev-main-debug.apk'), false)
})

test('ignores the source stamp certificate when reading apk signers', () => {
  const signers = parseSigners(`Signer #1 certificate DN: CN=Satsigner release
Signer #1 certificate SHA-256 digest: AABB
Source Stamp Signer certificate DN: CN=Stamp
Source Stamp Signer certificate SHA-256 digest: AABB`)
  assert.deepEqual(signers, [
    { name: 'CN=Satsigner release', sha256: 'aabb', signer: 'Signer #1' }
  ])
})
