import crypto from 'react-native-aes-crypto'

function sha256(text: string) {
  return crypto.sha256(text)
}

function aesEncrypt(text: string, key: string, iv: string) {
  return crypto.encrypt(text, key, iv, 'aes-256-cbc')
}

function aesDecrypt(cipher: string, key: string, iv: string) {
  return crypto.decrypt(cipher, key, iv, 'aes-256-cbc')
}

/** Password-based key derivation */
function pbkdf2Encrypt(pin: string, salt: string) {
  return crypto.pbkdf2(pin, salt, 10_000, 256, 'sha256')
}

function generateSalt() {
  return crypto.randomKey(16)
}

async function doubleShaEncrypt(text: string) {
  // TODO: remove
  const first = await crypto.sha256(text)

  return crypto.sha256(first)
}

export {
  aesDecrypt,
  aesEncrypt,
  doubleShaEncrypt,
  generateSalt,
  pbkdf2Encrypt,
  sha256
}
