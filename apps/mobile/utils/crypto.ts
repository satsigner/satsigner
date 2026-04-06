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

function sha256(text: string): Promise<string> {
  const hash = QuickCrypto.createHash('sha256')
  hash.update(text)
  return Promise.resolve(hash.digest().toString('hex'))
}

function toHex(data: ArrayBuffer | Buffer | string): string {
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString('hex')
  }
  if (typeof data === 'string') {
    return data
  }
  return data.toString('hex')
}

function aesEncrypt(text: string, key: string, iv: string): Promise<string> {
  const cipher = QuickCrypto.createCipheriv(
    'aes-256-cbc',
    new Uint8Array(Buffer.from(key, 'hex')),
    new Uint8Array(Buffer.from(iv, 'hex'))
  )
  const updated = cipher.update(new Uint8Array(Buffer.from(text, 'utf8')))
  const finalized = cipher.final('hex')
  return Promise.resolve(toHex(updated) + finalized)
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
    new Uint8Array(Buffer.from(ciphertext, 'hex'))
  )
  const finalized = decipher.final('hex')
  return Promise.resolve(
    Buffer.from(toHex(updated) + finalized, 'hex').toString('utf8')
  )
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

// FIX: me
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
  sha256
}
