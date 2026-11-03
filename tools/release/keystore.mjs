import { execFileSync } from 'node:child_process'
import { createPrivateKey, hkdfSync, timingSafeEqual } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'

const KEY_INFO = 'satsigner android release key v1'
const PASSWORD_INFO = 'satsigner android keystore password v1'
const KEY_ALIAS = 'satsigner'
const CERT_DAYS = '10000'
const P256_ORDER = BigInt(
  '0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'
)
const PKCS8_PREFIX = Buffer.from(
  '3041020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420',
  'hex'
)

const releaseDir = join(homedir(), '.satsigner')
const keystorePath = join(releaseDir, 'release.p12')
const passwordPath = join(releaseDir, 'release.pass')

function deriveBytes(seed, info, length) {
  return Buffer.from(
    hkdfSync('sha256', seed, Buffer.alloc(0), Buffer.from(info), length)
  )
}

function privateKeyBytes(seed) {
  for (let counter = 0; counter < 8; counter += 1) {
    const bytes = deriveBytes(seed, `${KEY_INFO} ${counter}`, 32)
    const scalar = BigInt(`0x${bytes.toString('hex')}`)
    if (scalar > 0n && scalar < P256_ORDER) {
      return bytes
    }
  }
  throw new Error('could not derive a P-256 key from this phrase')
}

function normalizeMnemonic(phrase) {
  return phrase.trim().toLowerCase().split(/\s+/).join(' ')
}

function privateKeyFromMnemonic(phrase) {
  const mnemonic = normalizeMnemonic(phrase)
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error('those are not 12 valid words')
  }
  const seed = mnemonicToSeedSync(mnemonic)
  const secret = privateKeyBytes(seed)
  const password = deriveBytes(seed, PASSWORD_INFO, 24).toString('base64url')
  const key = createPrivateKey({
    key: Buffer.concat([PKCS8_PREFIX, secret]),
    format: 'der',
    type: 'pkcs8'
  })
  return { key, mnemonic, password }
}

function writeKeystore(phrase) {
  const { key, password } = privateKeyFromMnemonic(phrase)
  mkdirSync(releaseDir, { recursive: true, mode: 0o700 })
  const keyPem = join(releaseDir, 'release-key.pem')
  const certPem = join(releaseDir, 'release-cert.pem')
  writeFileSync(keyPem, key.export({ format: 'pem', type: 'pkcs8' }), {
    mode: 0o600
  })
  try {
    execFileSync('openssl', [
      'req',
      '-new',
      '-x509',
      '-key',
      keyPem,
      '-out',
      certPem,
      '-days',
      CERT_DAYS,
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
        keystorePath,
        '-name',
        KEY_ALIAS,
        '-passout',
        'env:KEYSTORE_PASS'
      ],
      { env: { ...process.env, KEYSTORE_PASS: password } }
    )
  } finally {
    rmSync(keyPem, { force: true })
    rmSync(certPem, { force: true })
  }
  writeFileSync(passwordPath, `${password}\n`, { mode: 0o600 })
  chmodSync(keystorePath, 0o600)
}

function privateKeysMatch(left, right) {
  const leftDer = left.export({ format: 'der', type: 'pkcs8' })
  const rightDer = right.export({ format: 'der', type: 'pkcs8' })
  return (
    leftDer.length === rightDer.length && timingSafeEqual(leftDer, rightDer)
  )
}

function storedKey() {
  const password = readFileSync(passwordPath, 'utf8').trim()
  const pem = execFileSync(
    'openssl',
    [
      'pkcs12',
      '-in',
      keystorePath,
      '-nocerts',
      '-nodes',
      '-passin',
      'env:KEYSTORE_PASS'
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, KEYSTORE_PASS: password }
    }
  )
  return createPrivateKey(pem)
}

function phraseMatchesKeystore(phrase) {
  if (!hasReleaseKeystore()) {
    throw new Error(`No release keystore at ${keystorePath}`)
  }
  const derived = privateKeyFromMnemonic(phrase)
  return privateKeysMatch(derived.key, storedKey())
}

function hasReleaseKeystore() {
  return existsSync(keystorePath) && existsSync(passwordPath)
}

function signingEnv(baseEnv) {
  if (!hasReleaseKeystore()) {
    return baseEnv
  }
  const password = readFileSync(passwordPath, 'utf8').trim()
  return {
    ...baseEnv,
    'ORG_GRADLE_PROJECT_android.injected.signing.key.alias': KEY_ALIAS,
    'ORG_GRADLE_PROJECT_android.injected.signing.key.password': password,
    'ORG_GRADLE_PROJECT_android.injected.signing.store.file': keystorePath,
    'ORG_GRADLE_PROJECT_android.injected.signing.store.password': password
  }
}

function createMnemonic() {
  return generateMnemonic(wordlist, 128)
}

export {
  createMnemonic,
  hasReleaseKeystore,
  keystorePath,
  passwordPath,
  phraseMatchesKeystore,
  privateKeyFromMnemonic,
  privateKeysMatch,
  signingEnv,
  writeKeystore
}
