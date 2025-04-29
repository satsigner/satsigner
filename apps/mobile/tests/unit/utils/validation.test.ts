import {
  validateAddress,
  validateDerivationPath,
  validateDescriptor,
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

describe('Validates descriptors', () => {
  const validDescriptors = [
    'pk(0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798)',
    'pkh(02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5)',
    'wpkh(02f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9)',
    'sh(03fff97bd5755eeea420453a14355235d382f6472f8568a18b2f057a1460297556)',
    `wpkh([24c3acee/49'/0'/0']xpub6CAUaws9XxaAMz3ZjnaTMw6NCCBZQo6cWtK5dDkmkFc5KbgfqmJdGGAHhVNUvfxhz8vSNmA7GuHjx1zJfMtXVCzQETf4xvDpBfFEEPXNgo9/0/*)`,
    'wsh([e6807791/44h/1h/0h]tpubDDAfvogaaAxaFJ6c15ht7Tq6ZmiqFYfrSmZsHu7tHXBgnjMZSHAeHSwhvjARNA6Qybon4ksPksjRbPDVp7yXA1KjTjSd5x18KHqbppnXP1s/0/*)',
    'pk(0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798)#12345678',
    `wpkh([60c6c741/84'/1'/0']tpubDDSsu3cncmRPe7hd3TYa419HMeHkdhGKNmUA17dDfyUogBE5pRKDPV14reDahCasFuJK9Zrnb9NXchBXCjhzgxRJgd5XHrVumiiqaTSwedx/0/*)#rqc6v9pp`,
    `sh(wpkh([24c3acee/49'/0'/0']xpub6CAUaws9XxaAMz3ZjnaTMw6NCCBZQo6cWtK5dDkmkFc5KbgfqmJdGGAHhVNUvfxhz8vSNmA7GuHjx1zJfMtXVCzQETf4xvDpBfFEEPXNgo9/0/*))`,
    'multi(1,022f8bde4d1a07209355b4a7250a5c5128e88b84bddc619ab7cba8d569b240efe4,025cbdf0646e5db4eaa398f365f2ea7a0e3d419b7e0330e39ce92bddedcac4f9bc)',
    'wsh(sortedmulti(2,[6f53d49c/44h/1h/0h]tpubDDjsCRDQ9YzyaAq9rspCfq8RZFrWoBpYnLxK6sS2hS2yukqSczgcYiur8Scx4Hd5AZatx5uzMtJQJhchufv1FRFanLqUP7JHwusSSpfcEp2/0/*,[e6807791/44h/1h/0h]tpubDDAfvogaaAxaFJ6c15ht7Tq6ZmiqFYfrSmZsHu7tHXBgnjMZSHAeHSwhvjARNA6Qybon4ksPksjRbPDVp7yXA1KjTjSd5x18KHqbppnXP1s/0/*,[367c9cfa/44h/1h/0h]tpubDDtPnSgWYk8dDnaDwnof4ehcnjuL5VoUt1eW2MoAed1grPHuXPDnkX1fWMvXfcz3NqFxPbhqNZ3QBdYjLz2hABeM9Z2oqMR1Gt2HHYDoCgh/0/*))#av0kxgw0',
    'sh(sortedmulti(2,03acd484e2f0c7f65309ad178a9f559abde09796974c57e714c35f110dfc27ccbe,022f01e5e15cca351daff3843fb70f3c2f0a1bdd05e5af888a67784ef3e10a2a01))'
  ]

  const invalidDescriptors = [
    'p2pk(0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798)',
    'p2pkh(02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee5)',
    'bc1qmj3dcj45tugree3f87mrxvc5aqm4hkz4vhskgj'
  ]

  it('Recognizes valid descriptors', () => {
    for (const descriptor of validDescriptors) {
      expect(validateDescriptor(descriptor)).toBe(true)
    }
  })

  it('Recognizes invalid descriptors', () => {
    for (const descriptor of invalidDescriptors) {
      expect(validateDescriptor(descriptor)).toBe(false)
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
