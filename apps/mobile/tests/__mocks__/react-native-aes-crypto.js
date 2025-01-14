export default {
  encrypt: jest.fn((text, key, iv, algorithm) =>
    Promise.resolve(`encrypted:${text}:${key}:${iv}:${algorithm}`)
  ),
  decrypt: jest.fn((ciphertext, key, iv, algorithm) =>
    Promise.resolve(`decrypted:${ciphertext}:${key}:${iv}:${algorithm}`)
  ),
  sha256: jest.fn((text) => Promise.resolve(`hashed:${text}`))
}
