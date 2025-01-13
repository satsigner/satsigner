import crypto from 'react-native-aes-crypto'

function aesEncrypt(text: string, key: string) {
  return crypto.encrypt(text, key, 'satsigner', 'aes-256-cbc')
}

function aesDecrypt(ciphertext: string, key: string) {
  return crypto.decrypt(ciphertext, key, 'satsigner', 'aes-256-cbc')
}

async function doubleShaEncrypt(text: string) {
  const first = await crypto.sha256(text)

  return crypto.sha256(first)
}

export { aesDecrypt, aesEncrypt, doubleShaEncrypt }
