import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildApkArgs,
  buildInitArgs,
  buildLoginArgs,
  buildPushArgs,
  buildZapstoreArgs,
  classifyLogLine,
  isApkName,
  isNostrRemote,
  parseAdbDevices,
  parsePackageList,
  redactSecrets,
  splitCompleteLines
} from './commands.mjs'
import { acceptConnect } from './nip46-bridge.mjs'

test('redacts bunker urls and secret keys', () => {
  const raw =
    'login bunker://abc?relay=wss://relay.example&secret=shh nsec1qqqq nbunksec1zzzz'
  const cleaned = redactSecrets(raw)
  assert.equal(cleaned.includes('shh'), false)
  assert.equal(cleaned.includes('nsec1qqqq'), false)
  assert.equal(cleaned.includes('nbunksec1zzzz'), false)
  assert.match(cleaned, /bunker:\/\/redacted/)
})

test('detects a nostr remote', () => {
  assert.equal(isNostrRemote('nostr://npub1example/satsigner\n'), true)
  assert.equal(
    isNostrRemote('https://github.com/satsigner/satsigner.git'),
    false
  )
})

test('login and init commands keep the key out of the argument names', () => {
  const login = buildLoginArgs('bunker://pk?secret=abc')
  assert.equal(login.includes('--nsec'), false)
  assert.equal(login.includes('--alias'), true)
  assert.equal(login.includes('--bunker-url'), true)
  assert.equal(login.at(-1), '--defaults')
  const init = buildInitArgs()
  assert.equal(init.includes('satsigner'), true)
  assert.deepEqual(buildPushArgs(), ['push', 'origin', 'HEAD'])
  assert.deepEqual(buildApkArgs(), [
    '--dir',
    'apps/mobile',
    'variant',
    '--',
    '--apk',
    '--release'
  ])
  assert.deepEqual(buildApkArgs({ kind: 'pixel' }).slice(-2), [
    '--abi',
    'arm64-v8a'
  ])
  assert.ok(buildApkArgs({ identity: 'prod' }).includes('--plain'))
  assert.ok(buildApkArgs({ identity: 'prod' }).includes('--prod'))
  assert.deepEqual(buildApkArgs({ identity: 'generic' }).slice(-1), ['--plain'])
  assert.equal(buildApkArgs({ identity: 'generic' }).includes('--prod'), false)
  assert.ok(buildApkArgs({ identity: 'prod', kind: 'pixel' }).includes('--abi'))
  assert.throws(() => buildApkArgs({ identity: 'debug' }), /unknown apk/)
})

test('bunker connect keeps the secret on the first request only', () => {
  assert.equal(acceptConnect(['client', 'secret'], 'secret', false), true)
  assert.equal(acceptConnect(['client'], 'secret', false), false)
  assert.equal(acceptConnect(['client'], 'secret', true), true)
})

test('accepts only plain apk file names', () => {
  assert.equal(isApkName('satsigner-dev-main-release.apk'), true)
  assert.equal(isApkName('../secret.apk'), false)
  assert.equal(isApkName('notes.txt'), false)
})

test('reads connected devices and satsigner packages', () => {
  assert.deepEqual(
    parseAdbDevices('List of devices attached\nemulator-5554 device\n'),
    ['emulator-5554']
  )
  assert.deepEqual(parseAdbDevices('offline-1 offline\n'), [])
  assert.deepEqual(
    parsePackageList(
      'package:com.satsigner.satsigner.dev\npackage:com.other.app\n'
    ),
    ['com.satsigner.satsigner.dev', 'com.other.app']
  )
})

test('sorts console lines into kinds', () => {
  const cases = [
    ['[3/4] Publish to Zapstore', 'milestone'],
    ['=== SatSigner Zapstore Publisher ===', 'milestone'],
    ['$ node apps/mobile/scripts/publish-zapstore.mjs --yes', 'milestone'],
    ['  APK: /tmp/satsigner-dev-plain-release-arm64.apk', 'milestone'],
    ['  Checking that Zapstore saved the release...', 'milestone'],
    ['  Reusing the APK already built from this exact source', 'milestone'],
    ['BUILD SUCCESSFUL in 4m 26s', 'success'],
    ['    ok      Release      3579fcad', 'success'],
    ['  The release is live on Zapstore.', 'success'],
    ['Done.', 'success'],
    ['done', 'success'],
    ['    missing App listing  5dea0e7a', 'error'],
    ['Error: Zapstore publish failed', 'error'],
    ['error: node exited with code 1', 'error'],
    ['> Task :app:mergeReleaseResources FAILED', 'error'],
    ['BUILD FAILED in 12s', 'error'],
    [
      '  Zapstore accepted the release but has not saved it. The relay holds',
      'error'
    ],
    ['signer bridge: sign_event', 'signer'],
    ['signer relay: event kind 24133', 'signer'],
    ['> Task :app:compileReleaseKotlin', 'detail'],
    ['1728 actionable tasks: 1696 executed, 32 up-to-date', 'detail'],
    ['{"kind":32267,"id":"5dea0e7a"}', 'detail'],
    ['', 'detail']
  ]
  for (const [line, kind] of cases) {
    assert.equal(classifyLogLine(line), kind, line)
  }
})

test('keeps a line split across output chunks together', () => {
  const first = splitCompleteLines('', 'BUILD SUCC')
  assert.deepEqual(first, { lines: [], pending: 'BUILD SUCC' })
  const second = splitCompleteLines(first.pending, 'ESSFUL\n[3/4] Pub')
  assert.deepEqual(second, {
    lines: ['BUILD SUCCESSFUL'],
    pending: '[3/4] Pub'
  })
})

test('builds zapstore args for dev channels without a production confirmation', () => {
  assert.deepEqual(
    buildZapstoreArgs({
      channel: 'dev',
      confirmedVersion: '',
      currentVersion: '0.3.12',
      only: 'zapstore'
    }),
    [
      'apps/mobile/scripts/publish-zapstore.mjs',
      '--yes',
      '--channel',
      'dev',
      '--only',
      'zapstore'
    ]
  )
})

test('forwards the confirmed version for production', () => {
  assert.deepEqual(
    buildZapstoreArgs({
      channel: 'primary',
      confirmedVersion: '0.3.12',
      currentVersion: '0.3.12',
      only: ''
    }),
    [
      'apps/mobile/scripts/publish-zapstore.mjs',
      '--yes',
      '--channel',
      'primary',
      '--confirm-production',
      '0.3.12'
    ]
  )
})

test('refuses production without a matching browser confirmation', () => {
  for (const confirmedVersion of [undefined, '', '0.3.11', true]) {
    assert.throws(
      () =>
        buildZapstoreArgs({
          channel: 'primary',
          confirmedVersion,
          currentVersion: '0.3.12',
          only: ''
        }),
      /not confirmed/
    )
  }
})

test('refuses production when the current version is unknown', () => {
  assert.throws(
    () =>
      buildZapstoreArgs({
        channel: 'primary',
        confirmedVersion: '',
        currentVersion: '',
        only: ''
      }),
    /not confirmed/
  )
})
