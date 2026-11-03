import { execFileSync } from 'node:child_process'
import {
  X509Certificate,
  createPrivateKey,
  hkdfSync,
  timingSafeEqual
} from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import {
  generateMnemonic,
  mnemonicToSeedSync,
  validateMnemonic
} from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'

import { certificatePem, selfSignedCertificate } from './certificate.mjs'

const KEY_INFO = 'satsigner android release key v1'
const PASSWORD_INFO = 'satsigner android keystore password v1'
const KEY_ALIAS = 'satsigner'
const PRIVATE_DIR_MODE = 0o700
const PRIVATE_FILE_MODE = 0o600
const P256_ORDER =
  0xff_ff_ff_ff_00_00_00_00_ff_ff_ff_ff_ff_ff_ff_ff_bc_e6_fa_ad_a7_17_9e_84_f3_b9_ca_c2_fc_63_25_51n
const PKCS8_PREFIX = Buffer.from(
  '3041020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420',
  'hex'
)

const releaseDir = join(homedir(), '.satsigner')

function keystoreFiles(dir) {
  return {
    keystore: join(dir, 'release.p12'),
    password: join(dir, 'release.pass')
  }
}

const keystorePath = keystoreFiles(releaseDir).keystore

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

function releaseIdentityFromMnemonic(phrase) {
  const mnemonic = normalizeMnemonic(phrase)
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error('those are not 12 valid words')
  }
  const seed = mnemonicToSeedSync(mnemonic)
  const secret = privateKeyBytes(seed)
  const password = deriveBytes(seed, PASSWORD_INFO, 24).toString('base64url')
  const key = createPrivateKey({
    format: 'der',
    key: Buffer.concat([PKCS8_PREFIX, secret]),
    type: 'pkcs8'
  })
  const certificate = selfSignedCertificate(key, secret)
  return { certificate, key, mnemonic, password }
}

function exportPkcs12({ certificate, key, password }, dir, outPath) {
  const keyPem = join(dir, 'release-key.pem')
  const certPem = join(dir, 'release-cert.pem')
  try {
    writeFileSync(keyPem, key.export({ format: 'pem', type: 'pkcs8' }), {
      mode: PRIVATE_FILE_MODE
    })
    chmodSync(keyPem, PRIVATE_FILE_MODE)
    writeFileSync(certPem, certificatePem(certificate))
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
        outPath,
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
}

function writeKeystore(phrase, dir = releaseDir) {
  const identity = releaseIdentityFromMnemonic(phrase)
  const files = keystoreFiles(dir)
  const pendingKeystore = `${files.keystore}.tmp`
  const pendingPassword = `${files.password}.tmp`
  mkdirSync(dir, { mode: PRIVATE_DIR_MODE, recursive: true })
  chmodSync(dir, PRIVATE_DIR_MODE)
  exportPkcs12(identity, dir, pendingKeystore)
  chmodSync(pendingKeystore, PRIVATE_FILE_MODE)
  writeFileSync(pendingPassword, `${identity.password}\n`, {
    mode: PRIVATE_FILE_MODE
  })
  chmodSync(pendingPassword, PRIVATE_FILE_MODE)
  renameSync(pendingKeystore, files.keystore)
  renameSync(pendingPassword, files.password)
  return identity
}

function buffersMatch(left, right) {
  return left.length === right.length && timingSafeEqual(left, right)
}

function privateKeysMatch(left, right) {
  return buffersMatch(
    left.export({ format: 'der', type: 'pkcs8' }),
    right.export({ format: 'der', type: 'pkcs8' })
  )
}

function readPkcs12(dir, sectionArg) {
  const files = keystoreFiles(dir)
  const password = readFileSync(files.password, 'utf8').trim()
  return execFileSync(
    'openssl',
    [
      'pkcs12',
      '-in',
      files.keystore,
      sectionArg,
      '-nodes',
      '-passin',
      'env:KEYSTORE_PASS'
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, KEYSTORE_PASS: password }
    }
  )
}

function storedIdentity(dir = releaseDir) {
  return {
    certificate: new X509Certificate(readPkcs12(dir, '-nokeys')).raw,
    key: createPrivateKey(readPkcs12(dir, '-nocerts'))
  }
}

function phraseMatchesKeystore(phrase, dir = releaseDir) {
  if (!hasReleaseKeystore(dir)) {
    throw new Error(`No release keystore at ${keystoreFiles(dir).keystore}`)
  }
  const derived = releaseIdentityFromMnemonic(phrase)
  const stored = storedIdentity(dir)
  return (
    privateKeysMatch(derived.key, stored.key) &&
    buffersMatch(derived.certificate, stored.certificate)
  )
}

function hasReleaseKeystore(dir = releaseDir) {
  const files = keystoreFiles(dir)
  return existsSync(files.keystore) && existsSync(files.password)
}

function signingEnv(baseEnv) {
  if (!hasReleaseKeystore()) {
    return baseEnv
  }
  const files = keystoreFiles(releaseDir)
  const password = readFileSync(files.password, 'utf8').trim()
  return {
    ...baseEnv,
    'ORG_GRADLE_PROJECT_android.injected.signing.key.alias': KEY_ALIAS,
    'ORG_GRADLE_PROJECT_android.injected.signing.key.password': password,
    'ORG_GRADLE_PROJECT_android.injected.signing.store.file': files.keystore,
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
  phraseMatchesKeystore,
  privateKeysMatch,
  releaseIdentityFromMnemonic,
  signingEnv,
  storedIdentity,
  writeKeystore
}
