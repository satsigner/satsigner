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
  return Promise.resolve(
    Buffer.from(hash.digest() as ArrayBuffer).toString('hex')
  )
}

function aesEncrypt(text: string, key: string, iv: string): Promise<string> {
  const cipher = QuickCrypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(key, 'hex'),
    Buffer.from(iv, 'hex')
  )
  let encrypted = Buffer.from(
    cipher.update(Buffer.from(text, 'utf8')) as ArrayBuffer
  ).toString('hex')
  encrypted += Buffer.from(cipher.final() as ArrayBuffer).toString('hex')
  return Promise.resolve(encrypted)
}

function aesDecrypt(
  ciphertext: string,
  key: string,
  iv: string
): Promise<string> {
  const decipher = QuickCrypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(key, 'hex'),
    Buffer.from(iv, 'hex')
  )
  let decrypted = Buffer.from(
    decipher.update(Buffer.from(ciphertext, 'hex')) as ArrayBuffer
  ).toString('utf8')
  decrypted += Buffer.from(decipher.final() as ArrayBuffer).toString('utf8')
  return Promise.resolve(decrypted)
}

/** Password-based key derivation */
function pbkdf2Encrypt(pin: string, salt: string): Promise<string> {
  const derived = QuickCrypto.pbkdf2Sync(pin, salt, 10_000, 256 / 8, 'sha256')
  return Promise.resolve(Buffer.from(derived as ArrayBuffer).toString('hex'))
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
