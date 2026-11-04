import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { X509Certificate, createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { generateMnemonic, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'

import { certificateFingerprint, certificatePem } from './certificate.mjs'
import {
  createMnemonic,
  phraseMatchesKeystore,
  privateKeysMatch,
  releaseIdentityFromMnemonic,
  signingEnv,
  storedCertificateHash,
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
const OTHER_PHRASE_CERTIFICATE_SHA256 =
  'AC:76:43:6F:4C:DF:7A:11:0F:DC:26:6B:FE:4D:9F:07:17:07:1D:6C:CC:68:11:96:85:A1:D3:05:FF:E7:59:DC'
const PRIVATE_FILE_MODE = 0o600
const RANDOM_PHRASES = 8
const RANDOM_RESTORES = 3
const WORDS = 12
const ANDROID_FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/
const NOT_VALID_WORDS = /12 valid words/

function randomPhrases(count) {
  return Array.from({ length: count }, () => createMnemonic())
}

function replaceWord(phrase, index, word) {
  return phrase
    .split(' ')
    .map((current, position) => (position === index ? word : current))
    .join(' ')
}

// A phrase one word away from `phrase` that still passes the checksum, the
// mistake the checksum cannot catch.
function validNeighbour(phrase) {
  const index = 0
  const original = phrase.split(' ')[index]
  const word = wordlist.find(
    (candidate) =>
      candidate !== original &&
      validateMnemonic(replaceWord(phrase, index, candidate), wordlist)
  )
  return replaceWord(phrase, index, word)
}

function badChecksum(phrase) {
  const last = WORDS - 1
  const word = wordlist.find(
    (candidate) =>
      !validateMnemonic(replaceWord(phrase, last, candidate), wordlist)
  )
  return replaceWord(phrase, last, word)
}

function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function keystoreBytes(dir) {
  return ['release.p12', 'release.pass'].map((name) =>
    readFileSync(join(dir, name))
  )
}

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

test('random phrases rebuild the same identity every time', () => {
  for (const phrase of randomPhrases(RANDOM_PHRASES)) {
    const first = releaseIdentityFromMnemonic(phrase)
    const second = releaseIdentityFromMnemonic(phrase)
    assert.deepEqual(first.certificate, second.certificate, phrase)
    assert.equal(privateKeysMatch(first.key, second.key), true, phrase)
    assert.equal(first.password, second.password, phrase)
  }
})

test('every random certificate has the fixed release fields', () => {
  for (const phrase of randomPhrases(RANDOM_PHRASES)) {
    const { certificate, key } = releaseIdentityFromMnemonic(phrase)
    const parsed = new X509Certificate(certificate)
    assert.equal(parsed.verify(parsed.publicKey), true, phrase)
    assert.equal(parsed.checkPrivateKey(key), true, phrase)
    assert.equal(parsed.subject, 'CN=Satsigner release')
    assert.equal(parsed.issuer, 'CN=Satsigner release')
    assert.equal(parsed.serialNumber, '01')
    assert.equal(
      new Date(parsed.validFrom).toISOString(),
      '2026-01-01T00:00:00.000Z'
    )
    assert.equal(
      new Date(parsed.validTo).toISOString(),
      '2076-01-01T00:00:00.000Z'
    )
    assert.equal(parsed.publicKey.asymmetricKeyType, 'ec')
    assert.equal(parsed.publicKey.asymmetricKeyDetails.namedCurve, 'prime256v1')
    const text = execFileSync(
      'openssl',
      ['x509', '-inform', 'DER', '-noout', '-text'],
      { encoding: 'utf8', input: certificate }
    )
    assert.match(text, /Version: 3 \(0x2\)/)
    assert.match(text, /Signature Algorithm: ecdsa-with-SHA256/)
  }
})

test('random phrases never share a key, certificate or password', () => {
  const identities = randomPhrases(RANDOM_PHRASES).map((phrase) =>
    releaseIdentityFromMnemonic(phrase)
  )
  const fingerprints = new Set(
    identities.map(({ certificate }) => certificateFingerprint(certificate))
  )
  const keys = new Set(
    identities.map(({ key }) =>
      key.export({ format: 'der', type: 'pkcs8' }).toString('hex')
    )
  )
  const passwords = new Set(identities.map(({ password }) => password))
  assert.equal(fingerprints.size, RANDOM_PHRASES)
  assert.equal(keys.size, RANDOM_PHRASES)
  assert.equal(passwords.size, RANDOM_PHRASES)
})

test('the fingerprint is the SHA-256 of the certificate in Android form', () => {
  const { certificate } = releaseIdentityFromMnemonic(createMnemonic())
  const fingerprint = certificateFingerprint(certificate)
  assert.match(fingerprint, ANDROID_FINGERPRINT)
  assert.equal(
    fingerprint.replaceAll(':', '').toLowerCase(),
    sha256Hex(certificate)
  )
})

test('the certificate survives a PEM round trip', () => {
  const { certificate } = releaseIdentityFromMnemonic(createMnemonic())
  assert.deepEqual(
    new X509Certificate(certificatePem(certificate)).raw,
    certificate
  )
})

test('known phrases keep their pinned certificates', () => {
  assert.equal(
    certificateFingerprint(
      releaseIdentityFromMnemonic(OTHER_PHRASE).certificate
    ),
    OTHER_PHRASE_CERTIFICATE_SHA256
  )
})

test('case and whitespace do not change the key', () => {
  const phrase = createMnemonic()
  const expected = releaseIdentityFromMnemonic(phrase).certificate
  const variants = [
    phrase.toUpperCase(),
    `   ${phrase}   `,
    phrase.replaceAll(' ', '   '),
    phrase.replaceAll(' ', '\t'),
    phrase.replaceAll(' ', '\n'),
    phrase
      .split(' ')
      .map((word, index) => (index % 2 ? word.toUpperCase() : word))
      .join(' ')
  ]
  for (const variant of variants) {
    assert.deepEqual(
      releaseIdentityFromMnemonic(variant).certificate,
      expected,
      JSON.stringify(variant)
    )
  }
})

test('rejects a phrase with a bad checksum', () => {
  for (const phrase of randomPhrases(RANDOM_PHRASES)) {
    const broken = badChecksum(phrase)
    assert.throws(() => releaseIdentityFromMnemonic(broken), NOT_VALID_WORDS)
  }
})

test('rejects anything but exactly 12 words', () => {
  const words = createMnemonic().split(' ')
  const cases = [
    words.slice(0, WORDS - 1).join(' '),
    [...words, words[0]].join(' '),
    generateMnemonic(wordlist, 160),
    generateMnemonic(wordlist, 256),
    '',
    '   ',
    undefined,
    null,
    12
  ]
  for (const phrase of cases) {
    assert.throws(
      () => releaseIdentityFromMnemonic(phrase),
      NOT_VALID_WORDS,
      String(phrase)
    )
  }
})

test('rejects typos and words outside the English list', () => {
  const phrase = createMnemonic()
  const [first] = phrase.split(' ')
  const typos = [
    `${first}x`,
    first.slice(0, -1),
    'bitcoin1',
    'ábaco',
    '12345'
  ].filter((word) => !wordlist.includes(word))
  assert.ok(typos.length >= 3)
  for (const typo of typos) {
    assert.throws(
      () => releaseIdentityFromMnemonic(replaceWord(phrase, 0, typo)),
      NOT_VALID_WORDS,
      typo
    )
  }
})

test('one word off with a valid checksum is a different key', () => {
  const phrase = createMnemonic()
  const neighbour = validNeighbour(phrase)
  assert.notEqual(neighbour, phrase)
  assert.notDeepEqual(
    releaseIdentityFromMnemonic(neighbour).certificate,
    releaseIdentityFromMnemonic(phrase).certificate
  )
})

test('restoring random phrases rebuilds the derived certificate', (t) => {
  for (const phrase of randomPhrases(RANDOM_RESTORES)) {
    const original = tempDir(t)
    const restored = tempDir(t)
    const derived = releaseIdentityFromMnemonic(phrase)
    writeKeystore(phrase, original)
    writeKeystore(phrase.toUpperCase(), restored)
    assert.deepEqual(storedIdentity(original).certificate, derived.certificate)
    assert.deepEqual(storedIdentity(restored).certificate, derived.certificate)
    assert.equal(
      privateKeysMatch(storedIdentity(restored).key, derived.key),
      true
    )
    assert.equal(
      storedCertificateHash(restored),
      sha256Hex(derived.certificate)
    )
    assert.equal(phraseMatchesKeystore(phrase, restored), true)
  }
})

test('wrong tries are rejected and leave the keystore untouched', (t) => {
  const dir = tempDir(t)
  const phrase = createMnemonic()
  writeKeystore(phrase, dir)
  const before = keystoreBytes(dir)
  assert.equal(phraseMatchesKeystore(validNeighbour(phrase), dir), false)
  assert.equal(phraseMatchesKeystore(createMnemonic(), dir), false)
  assert.throws(
    () => phraseMatchesKeystore(badChecksum(phrase), dir),
    NOT_VALID_WORDS
  )
  assert.throws(
    () => phraseMatchesKeystore(generateMnemonic(wordlist, 256), dir),
    NOT_VALID_WORDS
  )
  assert.throws(() => phraseMatchesKeystore('', dir), NOT_VALID_WORDS)
  assert.deepEqual(keystoreBytes(dir), before)
  assert.equal(phraseMatchesKeystore(phrase, dir), true)
})

test('an invalid restore leaves the existing keystore in place', (t) => {
  const dir = tempDir(t)
  const phrase = createMnemonic()
  writeKeystore(phrase, dir)
  const before = keystoreBytes(dir)
  assert.throws(() => writeKeystore(badChecksum(phrase), dir), NOT_VALID_WORDS)
  assert.deepEqual(keystoreBytes(dir), before)
  assert.equal(phraseMatchesKeystore(phrase, dir), true)
})

test('confirm says clearly when there is no keystore', (t) => {
  const dir = tempDir(t)
  assert.throws(
    () => phraseMatchesKeystore(createMnemonic(), dir),
    /No release keystore/
  )
})

test('confirm fails when the password file does not open the keystore', (t) => {
  const dir = tempDir(t)
  const phrase = createMnemonic()
  writeKeystore(phrase, dir)
  writeFileSync(join(dir, 'release.pass'), 'not-the-password\n')
  assert.throws(() => phraseMatchesKeystore(phrase, dir))
})

test('release signing refuses to build without a release keystore', (t) => {
  const dir = tempDir(t)
  assert.throws(
    () => signingEnv({ PATH: '/bin' }, dir),
    /No Android release keystore/
  )
})

test('release signing points gradle at the release keystore', (t) => {
  const dir = tempDir(t)
  writeKeystore(PHRASE, dir)
  const env = signingEnv({ PATH: '/bin' }, dir)
  const password = readFileSync(join(dir, 'release.pass'), 'utf8').trim()
  assert.equal(env.PATH, '/bin')
  assert.equal(
    env['ORG_GRADLE_PROJECT_android.injected.signing.store.file'],
    join(dir, 'release.p12')
  )
  assert.equal(
    env['ORG_GRADLE_PROJECT_android.injected.signing.store.password'],
    password
  )
  assert.equal(
    env['ORG_GRADLE_PROJECT_android.injected.signing.key.alias'],
    'satsigner'
  )
})

test('a replace that fails midway keeps the old keystore and password together', (t) => {
  const dir = tempDir(t)
  writeKeystore(OTHER_PHRASE, dir)
  const before = keystoreBytes(dir)
  mkdirSync(join(dir, 'release.pass.bak', 'blocker'), { recursive: true })
  assert.throws(() => writeKeystore(PHRASE, dir))
  assert.deepEqual(keystoreBytes(dir), before)
  assert.equal(phraseMatchesKeystore(OTHER_PHRASE, dir), true)
  for (const name of [
    'release.p12.tmp',
    'release.pass.tmp',
    'release.p12.bak'
  ]) {
    assert.equal(existsSync(join(dir, name)), false)
  }
})

test('a successful replace leaves no backups behind', (t) => {
  const dir = tempDir(t)
  writeKeystore(OTHER_PHRASE, dir)
  writeKeystore(PHRASE, dir)
  for (const name of ['release.p12.bak', 'release.pass.bak']) {
    assert.equal(existsSync(join(dir, name)), false)
  }
})
