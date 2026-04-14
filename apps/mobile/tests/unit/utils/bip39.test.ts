import { KeychainKind, Network as BdkNetwork } from 'react-native-bdk-sdk'

import { type ScriptVersionType } from '@/types/models/Account'
import { getFingerprintFromSeed } from '@/utils/bip32'
import {
  detectElectrumSeed,
  generateMnemonic,
  generateMnemonicFromEntropy,
  getElectrumDerivationPath,
  getExtendedPublicKeyFromMnemonic,
  getFingerprintFromMnemonic,
  getPublicDescriptorFromMnemonic,
  getWordList,
  isElectrumDerivationPath,
  mnemonicToSeed,
  mnemonicToSeedElectrum,
  validateMnemonic,
  WORDLIST_LIST
} from '@/utils/bip39'

const englishMnemonic =
  'visa toddler sentence rival twin believe report person library security stadium hurt'
const spanishMnemonic =
  'vaina tejado recurso previo toro asistir poco onda lista realidad seco hundir'
const frenchMnemonic =
  'usure substrat public placard tirelire attirer permuter nébuleux ineptie promener ruser garnir'

const englishMnemonicFingerprint = '49fbe507'
const spanishMnemonicFingerprint = '6c70090f'
const frenchMnemonicFingerprint = '86532159'

const extendedPublicKeyTests = [
  [
    [englishMnemonic, '', BdkNetwork.Bitcoin, 'P2PKH'],
    'xpub6D8gBE7TKnqPhMZDoC15WsgkSCkCvtKgjpmCKxhRQ3Xd8WJDLPtFw5WCXhShKc4KkXj1yY1da4zvBNE39zRZQvAAg5yWp8aPqWAw9ZLv5qg'
  ],
  [
    [englishMnemonic, '', BdkNetwork.Bitcoin, 'P2SH-P2WPKH'],
    'xpub6DFNdfLsZHNrsB5Q6KrrGD1Hg1GFgRvdfi1Qd1JJdsZELVJXpucbixvvP6SxiimL2a4E7PXGbtM7tQ5msGxuQE1cnrzdb6obcwd4C24QPiz'
  ],
  [
    [englishMnemonic, '', BdkNetwork.Bitcoin, 'P2WPKH'],
    'xpub6CtcSUidffGCVPgtENAnGMeymsvJd3GPzMAmzG6SYWxmPK7jZQMTSf3pqbYnpervo49tXmMV2xMre7srJ9msVbse3fvWK1ivN7JvtZ5ApLF'
  ],
  [
    [englishMnemonic, '', BdkNetwork.Signet, 'P2PKH'],
    'tpubDD4b9xM3AD2FJCbCKkcbVGY6sbkAB5THK9BQHju6ePxBDo2rxrv6cs51s8pzVcDqPJR28hCMbMSgZxg6VbmCqdirJv5CQUZYNBYosy5u8fB'
  ],
  [
    [englishMnemonic, '', BdkNetwork.Signet, 'P2SH-P2WPKH'],
    'tpubDCpwAp9rMW8PgwKN2tK6k1NE2V6Xefn3o5RPx1XMbd2VgHYWLW7wCyfsSNWyv7czfYXX3rFjE2wjF9kuo6oDgiN6M6RzsNkBjH8YwhEtTwB'
  ],
  [
    [englishMnemonic, '', BdkNetwork.Signet, 'P2WPKH'],
    'tpubDCh12uBNfxDgMYyqV4G5zoFKmhVNK3oMWpc36gCLR7FT7frx5EFEGJeeZv6vcmPuvqVJJoDMywd3Fxe5F2AeBieG6BRJQmsunVE6j3qDWV5'
  ],
  [
    [spanishMnemonic, '', BdkNetwork.Bitcoin, 'P2PKH'],
    'xpub6BjME3EuD8kQN4JWLEw81wmw929GDxjsa2p8NcFeiZGELtWdoPExfxLdC8iqjXjCGrNQBYohvmL8PHnoibu4UsL8GydUHyRnSdC7QNfdkfu'
  ],
  [
    [spanishMnemonic, '', BdkNetwork.Bitcoin, 'P2SH-P2WPKH'],
    'xpub6DJNsBRdJMk6wE2txp9SbJrxy1jcKT1asdXWpMcBmaoL3kbvfRcmmfN4ukGyTR9McDjGRTm86A6EJj47KoodwwTcbFwquvBEEpuBJjWuuKs'
  ],
  [
    [spanishMnemonic, '', BdkNetwork.Bitcoin, 'P2WPKH'],
    'xpub6CEYv9XiSDGGVfVZQg5d9fQkE1D9g842gxFJcxsZ5H2gjibuzyuqf1F1hENtnHRNsAfXD8rs8kCJ5K44Soua9zTixnp1t8PzNuRY54PVXPM'
  ],
  [
    [spanishMnemonic, '', BdkNetwork.Signet, 'P2PKH'],
    'tpubDCkMLj4MVeL9oCPVBHNBAKRw1Yg9JUAjyoxtwoZYUB4BNkSJyYqn14ch9ETMPVf95bcXMF4G93VC3mJViQ6C1YB4McZQF4LGW8Hm4BL1yzC'
  ],
  [
    [spanishMnemonic, '', BdkNetwork.Signet, 'P2SH-P2WPKH'],
    'tpubDDE85Q7CkrrMHVsUFEvzB8TYRAcBQAT89vVUN3i63QxHm5H78qqRrLcWxyGiBSGm2ZYgzgdMQX4soKxA4dBG4LG5ZSCNr2YxML496o5CJPs'
  ],
  [
    [spanishMnemonic, '', BdkNetwork.Signet, 'P2WPKH'],
    'tpubDDLUuNo3GPFeDdxsPuTsLdxvChs4CR8h7R7bhyAymJmyaR5zoLCxWYRWkPaAF9qynRK8qV5gizYAgM1nDuGCPVcA7wixj7EdoP6PD5WcZuD'
  ]
]

const descriptorTests = [
  [
    [englishMnemonic, '', BdkNetwork.Bitcoin, 'P2PKH'],
    `pkh([49fbe507/44'/0'/0']xpub6D8gBE7TKnqPhMZDoC15WsgkSCkCvtKgjpmCKxhRQ3Xd8WJDLPtFw5WCXhShKc4KkXj1yY1da4zvBNE39zRZQvAAg5yWp8aPqWAw9ZLv5qg/0/*)`
  ],
  [
    [englishMnemonic, '', BdkNetwork.Bitcoin, 'P2SH-P2WPKH'],
    `sh(wpkh([49fbe507/49'/0'/0']xpub6DFNdfLsZHNrsB5Q6KrrGD1Hg1GFgRvdfi1Qd1JJdsZELVJXpucbixvvP6SxiimL2a4E7PXGbtM7tQ5msGxuQE1cnrzdb6obcwd4C24QPiz/0/*))`
  ],
  [
    [englishMnemonic, '', BdkNetwork.Bitcoin, 'P2WPKH'],
    `wpkh([49fbe507/84'/0'/0']xpub6CtcSUidffGCVPgtENAnGMeymsvJd3GPzMAmzG6SYWxmPK7jZQMTSf3pqbYnpervo49tXmMV2xMre7srJ9msVbse3fvWK1ivN7JvtZ5ApLF/0/*)`
  ],
  [
    [englishMnemonic, '', BdkNetwork.Signet, 'P2PKH'],
    `pkh([49fbe507/44'/1'/0']tpubDD4b9xM3AD2FJCbCKkcbVGY6sbkAB5THK9BQHju6ePxBDo2rxrv6cs51s8pzVcDqPJR28hCMbMSgZxg6VbmCqdirJv5CQUZYNBYosy5u8fB/0/*)`
  ],
  [
    [englishMnemonic, '', BdkNetwork.Signet, 'P2SH-P2WPKH'],
    `sh(wpkh([49fbe507/49'/1'/0']tpubDCpwAp9rMW8PgwKN2tK6k1NE2V6Xefn3o5RPx1XMbd2VgHYWLW7wCyfsSNWyv7czfYXX3rFjE2wjF9kuo6oDgiN6M6RzsNkBjH8YwhEtTwB/0/*))`
  ],
  [
    [englishMnemonic, '', BdkNetwork.Signet, 'P2WPKH'],
    `wpkh([49fbe507/84'/1'/0']tpubDCh12uBNfxDgMYyqV4G5zoFKmhVNK3oMWpc36gCLR7FT7frx5EFEGJeeZv6vcmPuvqVJJoDMywd3Fxe5F2AeBieG6BRJQmsunVE6j3qDWV5/0/*)`
  ],
  [
    [spanishMnemonic, '', BdkNetwork.Bitcoin, 'P2PKH'],
    `pkh([6c70090f/44'/0'/0']xpub6BjME3EuD8kQN4JWLEw81wmw929GDxjsa2p8NcFeiZGELtWdoPExfxLdC8iqjXjCGrNQBYohvmL8PHnoibu4UsL8GydUHyRnSdC7QNfdkfu/0/*)`
  ],
  [
    [spanishMnemonic, '', BdkNetwork.Bitcoin, 'P2SH-P2WPKH'],
    `sh(wpkh([6c70090f/49'/0'/0']xpub6DJNsBRdJMk6wE2txp9SbJrxy1jcKT1asdXWpMcBmaoL3kbvfRcmmfN4ukGyTR9McDjGRTm86A6EJj47KoodwwTcbFwquvBEEpuBJjWuuKs/0/*))`
  ],
  [
    [spanishMnemonic, '', BdkNetwork.Bitcoin, 'P2WPKH'],
    `wpkh([6c70090f/84'/0'/0']xpub6CEYv9XiSDGGVfVZQg5d9fQkE1D9g842gxFJcxsZ5H2gjibuzyuqf1F1hENtnHRNsAfXD8rs8kCJ5K44Soua9zTixnp1t8PzNuRY54PVXPM/0/*)`
  ],
  [
    [spanishMnemonic, '', BdkNetwork.Signet, 'P2PKH'],
    `pkh([6c70090f/44'/1'/0']tpubDCkMLj4MVeL9oCPVBHNBAKRw1Yg9JUAjyoxtwoZYUB4BNkSJyYqn14ch9ETMPVf95bcXMF4G93VC3mJViQ6C1YB4McZQF4LGW8Hm4BL1yzC/0/*)`
  ],
  [
    [spanishMnemonic, '', BdkNetwork.Signet, 'P2SH-P2WPKH'],
    `sh(wpkh([6c70090f/49'/1'/0']tpubDDE85Q7CkrrMHVsUFEvzB8TYRAcBQAT89vVUN3i63QxHm5H78qqRrLcWxyGiBSGm2ZYgzgdMQX4soKxA4dBG4LG5ZSCNr2YxML496o5CJPs/0/*))`
  ],
  [
    [spanishMnemonic, '', BdkNetwork.Signet, 'P2WPKH'],
    `wpkh([6c70090f/84'/1'/0']tpubDDLUuNo3GPFeDdxsPuTsLdxvChs4CR8h7R7bhyAymJmyaR5zoLCxWYRWkPaAF9qynRK8qV5gizYAgM1nDuGCPVcA7wixj7EdoP6PD5WcZuD/0/*)`
  ]
]

// Known Electrum segwit wallet — verified against Electrum 4.x
// root_fingerprint: e30a0cd1, derivation: m/0h
const electrumSegwitMnemonic =
  'love narrow noble little cat wonder daring drift absent lyrics noodle pudding'
const electrumSegwitFingerprint = 'e30a0cd1'

// get extended key from mnemonic
describe('bip39 utils', () => {
  it('validate mnemonic in multiple languages', () => {
    expect(validateMnemonic(englishMnemonic)).toBeTruthy()
    expect(validateMnemonic(englishMnemonic, 'spanish')).toBeFalsy()
    expect(validateMnemonic(frenchMnemonic)).toBeFalsy()
    expect(validateMnemonic(frenchMnemonic, 'french')).toBeTruthy()
    expect(validateMnemonic(spanishMnemonic)).toBeFalsy()
    expect(validateMnemonic(spanishMnemonic, 'spanish')).toBeTruthy()
  })

  it('generates mnemonic in multiple languages', () => {
    const englishMnemonic = generateMnemonic(12)
    const czechMnemonic = generateMnemonic(12, 'czech')
    const japaneseMnemonic = generateMnemonic(12, 'japanese')

    expect(validateMnemonic(englishMnemonic)).toBeTruthy()
    expect(validateMnemonic(czechMnemonic, 'czech')).toBeTruthy()
    expect(validateMnemonic(japaneseMnemonic, 'japanese')).toBeTruthy()
  })

  it('get fingerprint from mnemonic in multiple languages', () => {
    expect(getFingerprintFromMnemonic(englishMnemonic)).toStrictEqual(
      englishMnemonicFingerprint
    )
    expect(getFingerprintFromMnemonic(spanishMnemonic)).toStrictEqual(
      spanishMnemonicFingerprint
    )
    expect(getFingerprintFromMnemonic(frenchMnemonic)).toStrictEqual(
      frenchMnemonicFingerprint
    )
  })

  it('gets extended public key from mnemonic', () => {
    for (const test of extendedPublicKeyTests) {
      const [[mnemonic, passphrase, network, scriptVersion], actualKey] = test
      const result = getExtendedPublicKeyFromMnemonic(
        mnemonic,
        passphrase,
        network as BdkNetwork,
        scriptVersion as ScriptVersionType
      )
      expect(result).toBe(actualKey)
    }
  })

  it('gets descriptor from mnemonic', () => {
    for (const test of descriptorTests) {
      const [[mnemonic, passphrase, network, scriptVersion], actualDescriptor] =
        test
      const result = getPublicDescriptorFromMnemonic(
        mnemonic,
        scriptVersion as ScriptVersionType,
        KeychainKind.External,
        passphrase,
        network as BdkNetwork
      )
      expect(result).toBe(actualDescriptor)
    }
  })
})

describe('mnemonicToSeed', () => {
  it('produces a 64-byte seed', () => {
    const seed = mnemonicToSeed(englishMnemonic)
    expect(seed).toBeInstanceOf(Uint8Array)
    expect(seed).toHaveLength(64)
  })

  it('is deterministic', () => {
    const seed1 = mnemonicToSeed(englishMnemonic)
    const seed2 = mnemonicToSeed(englishMnemonic)
    expect(Buffer.from(seed1).toString('hex')).toBe(
      Buffer.from(seed2).toString('hex')
    )
  })

  it('produces different seeds for different mnemonics', () => {
    const seed1 = mnemonicToSeed(englishMnemonic)
    const seed2 = mnemonicToSeed(spanishMnemonic)
    expect(Buffer.from(seed1).toString('hex')).not.toBe(
      Buffer.from(seed2).toString('hex')
    )
  })

  it('produces different seed with passphrase', () => {
    const seedNoPass = mnemonicToSeed(englishMnemonic)
    const seedWithPass = mnemonicToSeed(englishMnemonic, 'mypassphrase')
    expect(Buffer.from(seedNoPass).toString('hex')).not.toBe(
      Buffer.from(seedWithPass).toString('hex')
    )
  })

  it('produces correct fingerprint for known mnemonics', () => {
    const seed = mnemonicToSeed(englishMnemonic)
    const fingerprint = getFingerprintFromSeed(seed)
    expect(fingerprint).toBe(englishMnemonicFingerprint)
  })

  it('works with non-English mnemonics', () => {
    const seed = mnemonicToSeed(spanishMnemonic)
    const fingerprint = getFingerprintFromSeed(seed)
    expect(fingerprint).toBe(spanishMnemonicFingerprint)
  })
})

describe('generateMnemonicFromEntropy', () => {
  it('generates valid mnemonic from 128-bit binary string', () => {
    const entropy = '0'.repeat(128)
    const mnemonic = generateMnemonicFromEntropy(entropy)
    expect(validateMnemonic(mnemonic)).toBe(true)
    expect(mnemonic.split(' ')).toHaveLength(12)
  })

  it('generates valid mnemonic from 256-bit binary string', () => {
    const entropy = '1'.repeat(256)
    const mnemonic = generateMnemonicFromEntropy(entropy)
    expect(validateMnemonic(mnemonic)).toBe(true)
    expect(mnemonic.split(' ')).toHaveLength(24)
  })

  it('is deterministic for same entropy', () => {
    const entropy = '10110101'.repeat(16)
    const m1 = generateMnemonicFromEntropy(entropy)
    const m2 = generateMnemonicFromEntropy(entropy)
    expect(m1).toBe(m2)
  })

  it('produces different mnemonics for different entropy', () => {
    const entropy1 = '0'.repeat(128)
    const entropy2 = '1'.repeat(128)
    const m1 = generateMnemonicFromEntropy(entropy1)
    const m2 = generateMnemonicFromEntropy(entropy2)
    expect(m1).not.toBe(m2)
  })

  it('rejects entropy shorter than 128 bits', () => {
    expect(() => generateMnemonicFromEntropy('0'.repeat(96))).toThrow(
      'Invalid Entropy'
    )
  })

  it('rejects entropy longer than 256 bits', () => {
    expect(() => generateMnemonicFromEntropy('0'.repeat(288))).toThrow(
      'Invalid Entropy'
    )
  })

  it('rejects entropy not divisible by 32', () => {
    expect(() => generateMnemonicFromEntropy('0'.repeat(129))).toThrow(
      'Invalid Entropy'
    )
  })

  it('generates valid mnemonic in non-English language', () => {
    const entropy = '0'.repeat(128)
    const mnemonic = generateMnemonicFromEntropy(entropy, 'spanish')
    expect(validateMnemonic(mnemonic, 'spanish')).toBe(true)
  })
})

describe('getWordList', () => {
  it('returns 2048 words for english', () => {
    const list = getWordList('english')
    expect(list).toHaveLength(2048)
    expect(list[0]).toBe('abandon')
    expect(list[2047]).toBe('zoo')
  })

  it('returns 2048 words for all supported languages', () => {
    for (const lang of WORDLIST_LIST) {
      const list = getWordList(lang)
      expect(list).toHaveLength(2048)
    }
  })

  it('defaults to english', () => {
    const defaultList = getWordList()
    const englishList = getWordList('english')
    expect(defaultList).toBe(englishList)
  })
})

describe('validateMnemonic edge cases', () => {
  it('rejects empty string', () => {
    expect(validateMnemonic('')).toBe(false)
  })

  it('rejects random words', () => {
    expect(
      validateMnemonic(
        'hello world foo bar baz qux one two three ten eleven twelve'
      )
    ).toBe(false)
  })

  it('rejects mnemonic with wrong checksum', () => {
    // Same as englishMnemonic but last word changed
    const badChecksum =
      'visa toddler sentence rival twin believe report person library security stadium abandon'
    expect(validateMnemonic(badChecksum)).toBe(false)
  })

  it('rejects valid mnemonic checked against wrong language', () => {
    expect(validateMnemonic(englishMnemonic, 'japanese')).toBe(false)
  })
})

describe('electrum seed utils', () => {
  describe('detectElectrumSeed', () => {
    it('detects a known Electrum segwit seed', () => {
      const result = detectElectrumSeed(electrumSegwitMnemonic)
      expect(result).toBe('segwit')
    })

    it('returns null for a BIP39 mnemonic', () => {
      const result = detectElectrumSeed(englishMnemonic)
      expect(result).toBeNull()
    })

    it('returns null for garbage input', () => {
      const result = detectElectrumSeed(
        'this is not a valid seed phrase at all'
      )
      expect(result).toBeNull()
    })

    it('is case and whitespace insensitive', () => {
      const upper = electrumSegwitMnemonic.toUpperCase()
      const extraSpaces = electrumSegwitMnemonic.replace(/ /g, '  ')
      expect(detectElectrumSeed(upper)).toBe('segwit')
      expect(detectElectrumSeed(extraSpaces)).toBe('segwit')
    })
  })

  describe('isElectrumDerivationPath', () => {
    it('matches Electrum derivation paths', () => {
      expect(isElectrumDerivationPath('m')).toBe(true)
      expect(isElectrumDerivationPath("m/0'")).toBe(true)
      expect(isElectrumDerivationPath('m/0h')).toBe(true)
    })

    it('rejects BIP44/49/84/86 and arbitrary paths', () => {
      expect(isElectrumDerivationPath("m/84'/0'/0'")).toBe(false)
      expect(isElectrumDerivationPath("m/44'/0'/0'")).toBe(false)
      expect(isElectrumDerivationPath("m/49'/0'/0'")).toBe(false)
      expect(isElectrumDerivationPath('')).toBe(false)
      expect(isElectrumDerivationPath('m/0/0')).toBe(false)
    })
  })

  describe('getElectrumDerivationPath', () => {
    it("returns m/0' for segwit seeds", () => {
      expect(getElectrumDerivationPath('segwit')).toBe("m/0'")
    })

    it('returns m for standard and 2fa-standard seeds', () => {
      expect(getElectrumDerivationPath('standard')).toBe('m')
      expect(getElectrumDerivationPath('2fa-standard')).toBe('m')
    })
  })

  describe('mnemonicToSeedElectrum', () => {
    it('derives the correct master key fingerprint for a known Electrum segwit seed', async () => {
      const seed = await mnemonicToSeedElectrum(electrumSegwitMnemonic)
      const fingerprint = getFingerprintFromSeed(Buffer.from(seed))
      expect(fingerprint).toBe(electrumSegwitFingerprint)
    })

    it('produces a 64-byte seed', async () => {
      const seed = await mnemonicToSeedElectrum(electrumSegwitMnemonic)
      expect(seed).toHaveLength(64)
    })

    it('is deterministic', async () => {
      const seed1 = await mnemonicToSeedElectrum(electrumSegwitMnemonic)
      const seed2 = await mnemonicToSeedElectrum(electrumSegwitMnemonic)
      expect(Buffer.from(seed1).toString('hex')).toBe(
        Buffer.from(seed2).toString('hex')
      )
    })

    it('produces a different seed when a passphrase is supplied', async () => {
      const seed = await mnemonicToSeedElectrum(electrumSegwitMnemonic)
      const seedWithPass = await mnemonicToSeedElectrum(
        electrumSegwitMnemonic,
        'passphrase'
      )
      expect(Buffer.from(seed).toString('hex')).not.toBe(
        Buffer.from(seedWithPass).toString('hex')
      )
    })
  })
})
