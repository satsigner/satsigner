import assert from 'node:assert/strict'
import test from 'node:test'

import {
  findTrackers,
  latestAsset,
  parseBadging,
  parsePermissions,
  parseSigners,
  securityChecks,
  zapstoreChecks
} from './apk-review.mjs'

const RELEASE_FINGERPRINT = 'AA:BB'
const RELEASE_HASH = 'aabb'

const BADGING = `package: name='com.example' versionCode='7' versionName='1.2.0' platformBuildVersionName='17'
sdkVersion:'24'
targetSdkVersion:'36'
application-label:'Example'
native-code: 'arm64-v8a'`

const PERMISSIONS = `package: com.example
uses-permission: name='android.permission.CAMERA'
uses-permission: name='android.permission.READ_EXTERNAL_STORAGE' maxSdkVersion='32'
uses-permission: name='android.permission.INTERNET'
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

test('reads requested permissions with their sdk cap', () => {
  assert.deepEqual(parsePermissions(PERMISSIONS), [
    { maxSdk: undefined, name: 'android.permission.CAMERA' },
    { maxSdk: 32, name: 'android.permission.READ_EXTERNAL_STORAGE' },
    { maxSdk: undefined, name: 'android.permission.INTERNET' }
  ])
})

test('reads every signer certificate, rotated ones included', () => {
  assert.deepEqual(
    parseSigners(SIGNERS).map((signer) => signer.sha256),
    ['aabb', 'ccdd']
  )
})

test('flags camera, gallery and microphone access for review', () => {
  const checks = securityChecks(apk())
  assert.equal(statusOf(checks, 'permission-camera'), 'warn')
  assert.equal(statusOf(checks, 'permission-gallery'), 'warn')
  assert.equal(statusOf(checks, 'permission-microphone'), 'pass')
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
