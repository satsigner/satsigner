import { Network as BDKNetwork } from 'bdk-rn/lib/lib/enums'

import {
  generateMnemonic,
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
    const network = BDKNetwork.Bitcoin
    const passphrase = undefined

    expect(
      getFingerprintFromMnemonic(englishMnemonic, passphrase, network)
    ).toEqual(englishMnemonicFingerprint)
    expect(
      getFingerprintFromMnemonic(spanishMnemonic, passphrase, network)
    ).toEqual(spanishMnemonicFingerprint)
    expect(
      getFingerprintFromMnemonic(frenchMnemonic, passphrase, network)
    ).toEqual(frenchMnemonicFingerprint)
  })
})
