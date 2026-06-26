import QuickCrypto from 'react-native-quick-crypto'
import uuid from 'react-native-uuid'

import { DEFAULT_PIN, PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'

const MAX_UINT32 = 0xffffffff // 2^32 - 1

function randomKey(length = 16): Promise<string> {
  return Promise.resolve(
    Buffer.from(QuickCrypto.randomBytes(length)).toString('hex')
  )
}

function randomUuid() {
  return uuid.v4()
}

function randomIv() {
  return uuid.v4().replace(/-/g, '')
}

function randomNum() {
  // global variable from react-native-get-random-values
  return crypto.getRandomValues(new Uint32Array(1))[0] / MAX_UINT32
}

/**
 * Deterministic PRNG (mulberry32). Same seed yields the same sequence, so
 * UTXO selection that relies on shuffling stays reproducible across runs.
 *
 * This matches the determinism *intent* of Sparrow's seeded STONEWALL selector
 * but NOT its numeric output: Sparrow uses java.util.Random (a 48-bit LCG), so
 * the same seed produces a different shuffle here, and the selected sets will
 * generally differ from Sparrow (both remain valid selections). Sparrow's
 * knapsack selector uses an unseeded Random and is therefore not reproducible
 * at all — it cannot be matched by any seeded generator.
 *
 * The bitwise ops are intentional 32-bit integer arithmetic: `>>> 0` coerces to
 * unsigned 32-bit and `| 0` wraps to signed 32-bit. Math.trunc would change the
 * result, so prefer-math-trunc/operator-assignment are disabled here.
 */
/* eslint-disable unicorn/prefer-math-trunc, operator-assignment */
function seededRandom(seed: number) {
  let state = seed >>> 0
  return function next() {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / MAX_UINT32
  }
}
/* eslint-enable unicorn/prefer-math-trunc, operator-assignment */

function sha256(text: string): Promise<string> {
  const hash = QuickCrypto.createHash('sha256')
  hash.update(text)
  return Promise.resolve(hash.digest().toString('hex'))
}

function aesEncrypt(text: string, key: string, iv: string): Promise<string> {
  const cipher = QuickCrypto.createCipheriv(
    'aes-256-cbc',
    new Uint8Array(Buffer.from(key, 'hex')),
    new Uint8Array(Buffer.from(iv, 'hex'))
  )
  const updated = cipher.update(new Uint8Array(Buffer.from(text, 'utf8')))
  const finalized = cipher.final()
  const result = Buffer.concat([
    Buffer.from(updated.buffer, updated.byteOffset, updated.byteLength),
    Buffer.from(finalized.buffer, finalized.byteOffset, finalized.byteLength)
  ])
  return Promise.resolve(result.toString('base64'))
}

function aesDecrypt(
  ciphertext: string,
  key: string,
  iv: string
): Promise<string> {
  const decipher = QuickCrypto.createDecipheriv(
    'aes-256-cbc',
    new Uint8Array(Buffer.from(key, 'hex')),
    new Uint8Array(Buffer.from(iv, 'hex'))
  )
  const updated = decipher.update(
    new Uint8Array(Buffer.from(ciphertext, 'base64'))
  )
  const finalized = decipher.final()
  const result = Buffer.concat([
    Buffer.from(updated.buffer, updated.byteOffset, updated.byteLength),
    Buffer.from(finalized.buffer, finalized.byteOffset, finalized.byteLength)
  ])
  return Promise.resolve(result.toString('utf8'))
}

/** Password-based key derivation */
function pbkdf2Encrypt(pin: string, salt: string): Promise<string> {
  const derived = QuickCrypto.pbkdf2Sync(pin, salt, 10_000, 256 / 8, 'sha256')
  return Promise.resolve(derived.toString('hex'))
}

function generateSalt(): Promise<string> {
  return randomKey(16)
}

async function doubleShaEncrypt(text: string): Promise<string> {
  const first = await sha256(text)
  return sha256(first)
}

async function getPinForDecryption(skipPin = false): Promise<string | null> {
  if (skipPin) {
    return DEFAULT_PIN
  }

  return await getItem(PIN_KEY)
}

export {
  aesDecrypt,
  aesEncrypt,
  doubleShaEncrypt,
  generateSalt,
  getPinForDecryption,
  pbkdf2Encrypt,
  randomIv,
  randomKey,
  randomNum,
  randomUuid,
  seededRandom,
  sha256
}
