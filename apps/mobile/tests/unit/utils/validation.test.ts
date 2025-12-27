import {
  validateAddress,
  validateDerivationPath,
  validateExtendedKey,
  validateFingerprint
} from '@/utils/validation'

describe('Validates addresses', () => {
  const validAddresses = [
    // BITCOIN MAINNET ADDRESSES
    '1HQQLXjYGesJunxE5fwFxHbG9Ks53nyZr9', // P2PKH (Pay to Public Key Hash):
    '3J6RG5DypZBgzxefCmbrNuxCHr9nfPmcbF', // P2SH (Pay to Script Hash):
    'bc1qmj3dcj45tugree3f87mrxvc5aqm4hkz4vhskgj', // P2WPKH (Pay to Witness Public Key Hash):
    'bc1pptev7vzxjvlpnazg6zk4l9j3qw6990kwfmz43ppyms79525qzf8q604wxw', // P2TR (Pay to Taproot):
    // BITCOIN TESTNET ADDRESSES
    'mwvMdapX5gJZguRqoEudnCob1KTmxSxP9p', // P2PKH:
    '2N9edKpA1S1h3CkHCsuDizrwTWCMxPsB1Qr', // P2SH:
    'tb1qmj3dcj45tugree3f87mrxvc5aqm4hkz4x3t9np', // P2WPKH:
    'tb1pptev7vzxjvlpnazg6zk4l9j3qw6990kwfmz43ppyms79525qzf8qd8rpup' // P2TR:
  ]

  const invalidAddresses = [
    'bc1p11111111111111111111111111111111111111',
    'bc5p5cyxnuxmeuwuvkwfem96l8z2f8g8g8g8g8g8g8'
  ]

  it('Recognizes valid addresses', () => {
    for (const address of validAddresses) {
      expect(validateAddress(address)).toBe(true)
    }
  })

  it('Recognizes invalid addresses', () => {
    for (const address of invalidAddresses) {
      expect(validateAddress(address)).toBe(false)
    }
  })
})

describe('Validates derivation paths', () => {
  const validDerivationPaths = [
    "m/44'/0'/0'/0",
    "m/84'/0'/0'/0",
    "m/86'/0'/0'/0",
    'm/44h/0h/0h/0',
    'm/84h/0h/0h/0',
    'm/86h/0h/0h/0',
    'm/1/2/3/4/5/6/7/8/9',
    "m/1'/2'/3'/4'/5'/6'/7'/8'/9'",
    'm/1/256',
    'm/1',
    "M/44'/0'/0'/0",
    "M/84'/0'/0'/0",
    "M/86'/0'/0'/0",
    'M/44h/0h/0h/0',
    'M/84h/0h/0h/0',
    'M/86h/0h/0h/0',
    'M/1/2/3/4/5/6/7/8/9',
    "M/1'/2'/3'/4'/5'/6'/7'/8'/9'",
    'M/1/256',
    'M/1',
    '1/2'
  ]
  const invalidDerivationPaths = ["m/44'/0'/0'/0/", 'm/44h/0h/0h/0/', 'm/a/b/c']

  it('Recognizes valid derivation paths', () => {
    for (const path of validDerivationPaths) {
      expect(validateDerivationPath(path)).toBe(true)
    }
  })

  it('Recognizes invalid derivation paths', () => {
    for (const path of invalidDerivationPaths) {
      expect(validateDerivationPath(path)).toBe(false)
    }
  })
})

describe('Validates master fingerprints', () => {
  const validFingerprints = [
    'a0b1c2d3',
    '0dfe45ff',
    '12345678',
    'abcdefde',
    'b1e3d434'
  ]
  const invalidFingerprints = [
    'abcdefga',
    'imnopqab',
    '12g56789',
    '0123uu',
    'aaa',
    '1234'
  ]

  it('Recognizes valid fingerprints', () => {
    for (const fingerprint of validFingerprints) {
      expect(validateFingerprint(fingerprint)).toBe(true)
    }
  })

  it('Recognizes invalid fingerprints', () => {
    for (const fingerprint of invalidFingerprints) {
      expect(validateFingerprint(fingerprint)).toBe(false)
    }
  })
})

describe('Validates extended keys', () => {
  const validExtendedKeys = [
    'xprvA3aefawL5RncTfcTBQCcD54pyyjJEe9FnNDHUh4tKFEQ7oZbxcKRETqLTJ4axsBwYzBBmqBYZYhM2a1pyZZKme265kU87bSezSS9kjN3huL',
    'xpub69M34K123tT7uiHGKBGrMe4KNnKuedu3hQFDhzovR938S3V5E5x7bv58sfej8rQ7hZLtXbTdDkjLpn5crdRKm3uphmEY24q28rMYT7qyXEr',
    'yprvALKcEo52JyxDRqdCgNnZ2x2P2UYcGPCpFWSGoatm9w7K8eeFFXjhVbnFGhxwchqiFC7qrMzz65MtHTFZb8pk5VRHVzBgfaqQh9UdkmSCh2v',
    'ypub6V5HorTR9bEwjVHAuAsjuhZapV766WDUPjz2KX93c74wSQde7Y9HMEqZJpjKA67rF7bkuZshe8ovTCcy27KMuyBkC3kpPt38HHVdGxV5Rbg',
    'zprvAWgYBBk7JR8GkkTuJFcj1jDuRv4WNw9cJruyifb4B2A6WSrbo114tiRTasQz1BoE3fBiB9PCNu82BPe1LeRCwFxE4wNj6ZSMMDkZLzxrLEX',
    'zpub6meLgZBh2ond7rC77f8jHxKUgd8bChCimrCQgEpiEC2NGzWZTbTsdq2cszuAJ1KwUgv8no6cweqrGHWDQ1Mi92H3tq1f7nhFJiBSkRFPNKR'
  ]

  it('Recognizes valid extended keys', () => {
    for (const key of validExtendedKeys) {
      expect(validateExtendedKey(key)).toBe(true)
    }
  })
})
