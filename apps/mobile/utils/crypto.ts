import crypto from 'react-native-aes-crypto'

function aesEncrypt(text: string, key: string, iv: string) {
  return crypto.encrypt(text, key, iv, 'aes-256-cbc')
}

function aesDecrypt(cipher: string, key: string, iv: string) {
  return crypto.decrypt(cipher, key, iv, 'aes-256-cbc')
}

async function doubleShaEncrypt(text: string) {
  const first = await crypto.sha256(text)

  return crypto.sha256(first)
}

export { aesDecrypt, aesEncrypt, doubleShaEncrypt }
