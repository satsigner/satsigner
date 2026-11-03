import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { X509Certificate } from 'node:crypto'
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { certificateFingerprint } from './certificate.mjs'
import {
  phraseMatchesKeystore,
  privateKeysMatch,
  releaseIdentityFromMnemonic,
  storedIdentity,
  writeKeystore
} from './keystore.mjs'

const PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
const OTHER_PHRASE =
  'legal winner thank year wave sausage worth useful legal winner thank yellow'
// Changing this breaks updates for every app already signed from a phrase.
const PHRASE_CERTIFICATE_SHA256 =
  '14:B5:17:E1:28:C8:D2:8C:D7:0E:21:BE:01:9D:A1:FC:4C:7B:04:FE:20:7C:9E:E1:1B:56:0B:AC:51:6E:DC:41'
const PRIVATE_FILE_MODE = 0o600

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'satsigner-keystore-'))
  t.after(() => rmSync(dir, { force: true, recursive: true }))
  return dir
}

test('the same 12 words rebuild the same android key', () => {
  const first = releaseIdentityFromMnemonic(PHRASE)
  const second = releaseIdentityFromMnemonic(`  ${PHRASE.toUpperCase()}  `)
  assert.equal(privateKeysMatch(first.key, second.key), true)
  assert.equal(first.password, second.password)
  assert.equal(first.password.length > 20, true)
})

test('the same 12 words rebuild the same certificate byte for byte', () => {
  const first = releaseIdentityFromMnemonic(PHRASE)
  const second = releaseIdentityFromMnemonic(PHRASE)
  assert.deepEqual(first.certificate, second.certificate)
  assert.equal(
    certificateFingerprint(first.certificate),
    PHRASE_CERTIFICATE_SHA256
  )
})

test('the certificate is a valid self-signed x509 for the derived key', () => {
  const { certificate, key } = releaseIdentityFromMnemonic(PHRASE)
  const parsed = new X509Certificate(certificate)
  assert.equal(parsed.verify(parsed.publicKey), true)
  assert.equal(parsed.checkPrivateKey(key), true)
  assert.equal(parsed.subject, 'CN=Satsigner release')
  assert.equal(parsed.issuer, 'CN=Satsigner release')
  assert.equal(new Date(parsed.validTo).getUTCFullYear(), 2076)
})

test('a different valid phrase is not the same key or certificate', () => {
  const first = releaseIdentityFromMnemonic(PHRASE)
  const other = releaseIdentityFromMnemonic(OTHER_PHRASE)
  assert.equal(privateKeysMatch(first.key, other.key), false)
  assert.notDeepEqual(first.certificate, other.certificate)
})

test('rejects a phrase that is not 12 valid words', () => {
  assert.throws(
    () => releaseIdentityFromMnemonic('not a real phrase'),
    /12 valid words/
  )
})

test('restoring on another machine gives the same signing certificate', (t) => {
  const original = tempDir(t)
  const restored = tempDir(t)
  writeKeystore(PHRASE, original)
  writeKeystore(PHRASE, restored)
  assert.deepEqual(
    storedIdentity(original).certificate,
    storedIdentity(restored).certificate
  )
  assert.equal(
    certificateFingerprint(storedIdentity(restored).certificate),
    PHRASE_CERTIFICATE_SHA256
  )
})

test('confirm accepts the right words and rejects others', (t) => {
  const dir = tempDir(t)
  writeKeystore(PHRASE, dir)
  assert.equal(phraseMatchesKeystore(PHRASE, dir), true)
  assert.equal(phraseMatchesKeystore(OTHER_PHRASE, dir), false)
})

test('replacing a keystore leaves only private files behind', (t) => {
  const dir = tempDir(t)
  writeKeystore(OTHER_PHRASE, dir)
  writeKeystore(PHRASE, dir)
  assert.equal(phraseMatchesKeystore(PHRASE, dir), true)
  for (const name of ['release.p12', 'release.pass']) {
    assert.equal(statSync(join(dir, name)).mode & 0o777, PRIVATE_FILE_MODE)
  }
  assert.throws(() => statSync(join(dir, 'release-key.pem')))
  assert.throws(() => statSync(join(dir, 'release.p12.tmp')))
})

test('confirm rejects a keystore with the right key but another certificate', (t) => {
  const dir = tempDir(t)
  const { key, password } = writeKeystore(PHRASE, dir)
  const keyPem = join(dir, 'key.pem')
  const certPem = join(dir, 'cert.pem')
  writeFileSync(keyPem, key.export({ format: 'pem', type: 'pkcs8' }))
  execFileSync('openssl', [
    'req',
    '-new',
    '-x509',
    '-key',
    keyPem,
    '-out',
    certPem,
    '-days',
    '1',
    '-subj',
    '/CN=Satsigner release'
  ])
  execFileSync(
    'openssl',
    [
      'pkcs12',
      '-export',
      '-inkey',
      keyPem,
      '-in',
      certPem,
      '-out',
      join(dir, 'release.p12'),
      '-passout',
      'env:KEYSTORE_PASS'
    ],
    { env: { ...process.env, KEYSTORE_PASS: password } }
  )
  assert.equal(phraseMatchesKeystore(PHRASE, dir), false)
})
