import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildApkArgs,
  buildInitArgs,
  buildLoginArgs,
  buildPushArgs,
  isApkName,
  isNostrRemote,
  redactSecrets
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
