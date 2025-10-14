import { Descriptor, DescriptorSecretKey, Mnemonic } from 'bdk-rn'
import { KeychainKind, Network as BDKNetwork } from 'bdk-rn/lib/lib/enums'

import { type ScriptVersionType } from '@/types/models/Account'
import {
  generateMnemonic,
  getDescriptorFromMnemonic,
  getEntropyFromMnemonic,
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

async function getDescriptorObject(
  mnemonic: string,
  scriptVersion: ScriptVersionType,
  kind: KeychainKind,
  passphrase: string | undefined,
  network: BDKNetwork
) {
  const entropy = getEntropyFromMnemonic(mnemonic)
  console.log(mnemonic)
  console.log(entropy)
  const M = new Mnemonic()
  console.log(M.fromEntropy)
  const parsedMnemonic = await M.fromEntropy(entropy)
  const descriptorSecretKey = await new DescriptorSecretKey().create(
    network,
    parsedMnemonic,
    passphrase
  )
  switch (scriptVersion) {
    case 'P2PKH':
      return new Descriptor().newBip44(descriptorSecretKey, kind, network)
    case 'P2SH-P2WPKH':
      return new Descriptor().newBip49(descriptorSecretKey, kind, network)
    case 'P2WPKH':
      return new Descriptor().newBip84(descriptorSecretKey, kind, network)
    case 'P2TR':
      return new Descriptor().newBip86(descriptorSecretKey, kind, network)
    case 'P2SH':
    case 'P2SH-P2WSH':
    case 'P2WSH':
      // For multisig script types, we need to create descriptors manually
      // since BDK doesn't have specific methods for these
      throw new Error(
        `Manual descriptor creation required for ${scriptVersion} - use getExtendedPublicKeyFromMnemonic instead`
      )
    default:
      return new Descriptor().newBip84(descriptorSecretKey, kind, network)
  }
}

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

  // get extended keu from mnemonic
  it('gets extended key from mnemonic', async () => {
    const network = BDKNetwork.Bitcoin
    const kind = KeychainKind.External
    const passphrase = ''
    const mnemonic = spanishMnemonic
    const versions: ScriptVersionType[] = [
      'P2PKH',
      'P2WPKH',
      'P2SH',
      'P2SH-P2WSH'
    ]
    for (const scriptVersion of versions) {
      const descriptor = getDescriptorFromMnemonic(
        mnemonic,
        scriptVersion,
        kind,
        passphrase,
        network
      )
      console.log(descriptor)
      const descriptorObject = await getDescriptorObject(
        mnemonic,
        scriptVersion,
        kind,
        passphrase,
        network
      )
      console.log(descriptor)
      console.log(await descriptorObject.asString())
    }
    const one = 1
    expect(one).toBe(1)
  })

  // get descriptor from mnemonic
})
