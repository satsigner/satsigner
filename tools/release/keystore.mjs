import { execFileSync } from 'node:child_process'
import {
  X509Certificate,
  createHash,
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

import {
  certificateFingerprint,
  certificatePem,
  selfSignedCertificate
} from './certificate.mjs'

const KEY_INFO = 'satsigner android release key v1'
const PASSWORD_INFO = 'satsigner android keystore password v1'
const KEY_ALIAS = 'satsigner'
const RELEASE_WORD_COUNT = 12
const RELEASE_ENTROPY_BITS = 128
const PRIVATE_DIR_MODE = 0o700
const PRIVATE_FILE_MODE = 0o600
const P256_ORDER =
  0xff_ff_ff_ff_00_00_00_00_ff_ff_ff_ff_ff_ff_ff_ff_bc_e6_fa_ad_a7_17_9e_84_f3_b9_ca_c2_fc_63_25_51n
const PKCS8_PREFIX = Buffer.from(
  '3041020100301306072a8648ce3d020106082a8648ce3d030107042730250201010420',
  'hex'
)

// The certificate every Satsigner release so far was signed with. A restore
// or a check that prints anything else used the wrong words.
const RELEASE_CERT_SHA256 =
  'E0:D6:E6:92:FA:D1:AA:16:26:FF:54:9A:CE:E3:47:C2:EB:CE:8B:E5:0D:07:44:CB:D0:D3:A6:75:39:F2:7E:D7'

const releaseDir = join(homedir(), '.satsigner')
const nextReleaseDir = join(releaseDir, 'next')

function keystoreFiles(dir) {
  return {
    keystore: join(dir, 'release.p12'),
    password: join(dir, 'release.pass')
  }
}

const keystorePath = keystoreFiles(releaseDir).keystore
const nextKeystorePath = keystoreFiles(nextReleaseDir).keystore

function lineageFile(dir = releaseDir) {
  return join(dir, 'release.lineage')
}

const lineagePath = lineageFile()

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
  return typeof phrase === 'string'
    ? phrase.trim().toLowerCase().split(/\s+/).join(' ')
    : ''
}

function isReleaseMnemonic(mnemonic) {
  return (
    mnemonic.split(' ').length === RELEASE_WORD_COUNT &&
    validateMnemonic(mnemonic, wordlist)
  )
}

function releaseIdentityFromMnemonic(phrase) {
  const mnemonic = normalizeMnemonic(phrase)
  if (!isReleaseMnemonic(mnemonic)) {
    throw new Error(`those are not ${RELEASE_WORD_COUNT} valid words`)
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

function moveAll(moves) {
  const done = []
  try {
    for (const move of moves) {
      renameSync(move.from, move.to)
      done.unshift(move)
    }
  } catch (error) {
    for (const move of done) {
      renameSync(move.to, move.from)
    }
    throw error
  }
}

function replacePair(files, pending) {
  const names = Object.keys(files)
  const backups = names
    .filter((name) => existsSync(files[name]))
    .map((name) => ({ from: files[name], to: `${files[name]}.bak` }))
  const installs = names.map((name) => ({
    from: pending[name],
    to: files[name]
  }))
  moveAll([...backups, ...installs])
  for (const backup of backups) {
    rmSync(backup.to, { force: true })
  }
}

function writeKeystore(phrase, dir = releaseDir) {
  const identity = releaseIdentityFromMnemonic(phrase)
  const files = keystoreFiles(dir)
  const pending = {
    keystore: `${files.keystore}.tmp`,
    password: `${files.password}.tmp`
  }
  mkdirSync(dir, { mode: PRIVATE_DIR_MODE, recursive: true })
  chmodSync(dir, PRIVATE_DIR_MODE)
  try {
    exportPkcs12(identity, dir, pending.keystore)
    chmodSync(pending.keystore, PRIVATE_FILE_MODE)
    writeFileSync(pending.password, `${identity.password}\n`, {
      mode: PRIVATE_FILE_MODE
    })
    chmodSync(pending.password, PRIVATE_FILE_MODE)
    replacePair(files, pending)
  } finally {
    rmSync(pending.keystore, { force: true })
    rmSync(pending.password, { force: true })
  }
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
  const password = readKeystorePassword(dir)
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

function readKeystorePassword(dir = releaseDir) {
  return readFileSync(keystoreFiles(dir).password, 'utf8').trim()
}

function storedCertificateHash(dir = releaseDir) {
  return createHash('sha256')
    .update(storedIdentity(dir).certificate)
    .digest('hex')
}

function requireReleaseKeystore(dir = releaseDir) {
  if (hasReleaseKeystore(dir)) {
    return
  }
  throw new Error(
    `No Android release keystore at ${keystoreFiles(dir).keystore}.\n` +
      'Create one with: pnpm --dir tools/release keystore\n' +
      'Release builds never fall back to the public debug key.'
  )
}

function signingEnv(baseEnv, dir = releaseDir) {
  requireReleaseKeystore(dir)
  const files = keystoreFiles(dir)
  const password = readKeystorePassword(dir)
  return {
    ...baseEnv,
    'ORG_GRADLE_PROJECT_android.injected.signing.key.alias': KEY_ALIAS,
    'ORG_GRADLE_PROJECT_android.injected.signing.key.password': password,
    'ORG_GRADLE_PROJECT_android.injected.signing.store.file': files.keystore,
    'ORG_GRADLE_PROJECT_android.injected.signing.store.password': password
  }
}

function storedFingerprint(dir = releaseDir) {
  return certificateFingerprint(storedIdentity(dir).certificate)
}

function hasRotation(dir = releaseDir) {
  return existsSync(lineageFile(dir)) && hasReleaseKeystore(join(dir, 'next'))
}

// After a rotation the newest certificate is the one Zapstore and new installs
// see, so the identity proof has to link that one.
function newestSignerDir(dir = releaseDir) {
  return hasRotation(dir) ? join(dir, 'next') : dir
}

function keyFingerprint(dir) {
  if (!hasReleaseKeystore(dir)) {
    return { present: false }
  }
  try {
    return { fingerprint: storedFingerprint(dir), present: true }
  } catch (error) {
    return { error: error.message, present: true }
  }
}

function releaseKeyStatus(dir = releaseDir) {
  const current = keyFingerprint(dir)
  const next = keyFingerprint(join(dir, 'next'))
  return {
    current: {
      ...current,
      matchesRelease: current.fingerprint === RELEASE_CERT_SHA256,
      path: keystoreFiles(dir).keystore
    },
    expectedFingerprint: RELEASE_CERT_SHA256,
    lineage: existsSync(lineageFile(dir)),
    next: { ...next, path: keystoreFiles(join(dir, 'next')).keystore },
    rotating: hasRotation(dir)
  }
}

function createMnemonic() {
  return generateMnemonic(wordlist, RELEASE_ENTROPY_BITS)
}

export {
  KEY_ALIAS,
  RELEASE_CERT_SHA256,
  createMnemonic,
  hasRotation,
  keystoreFiles,
  lineageFile,
  lineagePath,
  newestSignerDir,
  nextKeystorePath,
  nextReleaseDir,
  releaseDir,
  releaseKeyStatus,
  storedFingerprint,
  hasReleaseKeystore,
  keystorePath,
  phraseMatchesKeystore,
  privateKeysMatch,
  readKeystorePassword,
  releaseIdentityFromMnemonic,
  requireReleaseKeystore,
  signingEnv,
  storedCertificateHash,
  storedIdentity,
  writeKeystore
}
