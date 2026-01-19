import aesCrypto from 'react-native-aes-crypto'

import { DEFAULT_PIN, PIN_KEY } from '@/config/auth'
import { getItem } from '@/storage/encrypted'

const MAX_UINT32 = 0xffffffff // 2^32 - 1

function randomKey(length = 16) {
  return aesCrypto.randomKey(length)
}

function randomUuid() {
  return aesCrypto.randomUuid()
}

function randomNum() {
  // global variable from react-native-get-random-values
  return crypto.getRandomValues(new Uint32Array(1))[0] / MAX_UINT32;
}

function sha256(text: string) {
  return aesCrypto.sha256(text)
}

function aesEncrypt(text: string, key: string, iv: string) {
  return aesCrypto.encrypt(text, key, iv, 'aes-256-cbc')
}

function aesDecrypt(cipher: string, key: string, iv: string) {
  return aesCrypto.decrypt(cipher, key, iv, 'aes-256-cbc')
}

/** Password-based key derivation */
function pbkdf2Encrypt(pin: string, salt: string) {
  return aesCrypto.pbkdf2(pin, salt, 10_000, 256, 'sha256')
}

function generateSalt() {
  return aesCrypto.randomKey(16)
}

async function doubleShaEncrypt(text: string) {
  // TODO: remove
  const first = await aesCrypto.sha256(text)

  return aesCrypto.sha256(first)
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
  randomKey,
  randomNum,
  randomUuid,
  sha256
}
