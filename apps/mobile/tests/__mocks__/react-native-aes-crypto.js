let randomKeyCounter = 0

function simpleHash(text) {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  const positiveHash = Math.abs(hash)
  const hexBase = positiveHash.toString(16).padStart(8, '0')
  return hexBase.repeat(8).slice(0, 64)
}

export default {
  encrypt: jest.fn((text, key, iv, algorithm) =>
    Promise.resolve(`encrypted:${text}:${key}:${iv}:${algorithm}`)
  ),
  decrypt: jest.fn((ciphertext, key, iv, algorithm) =>
    Promise.resolve(`decrypted:${ciphertext}:${key}:${iv}:${algorithm}`)
  ),
  pbkdf2: jest.fn((password, salt, cost, length, algorithm) =>
    Promise.resolve(`pbkdf2:${password}:${salt}:${cost}:${length}:${algorithm}`)
  ),
  sha256: jest.fn((text) => Promise.resolve(simpleHash(text))),
  randomKey: jest.fn((length) => {
    randomKeyCounter++
    const bytes = Array.from({ length }, (_, i) =>
      ((i + randomKeyCounter) % 256).toString(16).padStart(2, '0')
    )
    return Promise.resolve(bytes.join(''))
  })
}
