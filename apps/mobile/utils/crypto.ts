import crypto from 'react-native-aes-crypto'

const IV = '7361747369676e65725f5f69766b6579'

function aesEncrypt(text: string, key: string) {
  return crypto.encrypt(text, key, IV, 'aes-256-cbc')
}

function aesDecrypt(ciphertext: string, key: string) {
  return crypto.decrypt(ciphertext, key, IV, 'aes-256-cbc')
}

async function doubleShaEncrypt(text: string) {
  const first = await crypto.sha256(text)

  return crypto.sha256(first)
}

export { aesDecrypt, aesEncrypt, doubleShaEncrypt }
