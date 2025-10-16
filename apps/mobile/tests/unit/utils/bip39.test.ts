import { KeychainKind, Network as BdkNetwork } from 'bdk-rn/lib/lib/enums'

import { type ScriptVersionType } from '@/types/models/Account'
import {
  generateMnemonic,
  getPublicDescriptorFromMnemonic,
  getExtendedPublicKeyFromMnemonic,
  getFingerprintFromMnemonic,
  validateMnemonic
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
    expect(getFingerprintFromMnemonic(englishMnemonic)).toEqual(
      englishMnemonicFingerprint
    )
    expect(getFingerprintFromMnemonic(spanishMnemonic)).toEqual(
      spanishMnemonicFingerprint
    )
    expect(getFingerprintFromMnemonic(frenchMnemonic)).toEqual(
      frenchMnemonicFingerprint
    )
  })

  it('gets extended public key from mnemonic', () => {
    for (const test of extendedPublicKeyTests) {
      const [mnemonic, passphrase, network, scriptVersion] = test[0]
      const actualKey = test[1]
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
      const [mnemonic, passphrase, network, scriptVersion] = test[0]
      const actualDescriptor = test[1]
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
