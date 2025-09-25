import { Network as BDKNetwork } from 'bdk-rn/lib/lib/enums'

import { type ScriptVersionType } from '@/types/models/Account'
import {
  getDescriptorsFromKey,
  getExtendedKeyFromDescriptor
} from '@/utils/bip32'

const tpub =
  'tpubD6NzVbkk1Y2Z3A4B5C6D7E8F9G0H1J2K3L4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z8A9B0C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0'
const upub =
  'upub5SLqN2bLY4k2T6wT9N7P8Q9R0S1T2U3V4W5X6Y7Z8A9B0C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6C7D8E9F0'
const vpub =
  'vpub5SLqN2bLY4k2T6wT9N7P8Q9R0S1T2U3V4W5X6Y7Z8A9B0C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4A5B6C7D8E9F0'
const xpub =
  'xpub6CUGRUonZSQ4Yf3s7X4W7Xwf1q3z3q2Z5J6Y7W8Y9X1Y2Z3A4B5C6D7E8F9G0H1J2K3L4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z8A9B0C1D2E3F4'
const ypub =
  'ypub6Ww3ibma2Y3Z4A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9Z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1'
const zpub =
  'zpub6rFRdN2Y3Z4A5B6C7D8E9F0G1H2I3J4K5L6M7N8O9P0Q1R2S3T4U5V6W7X8Y9Z0A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0U1'

const fingerprint = '12345678'
const account = 0
const coinTypeMainnet = 0
const coinTypeTestnet = 1

const sampleMainnetKeys = [xpub, ypub, zpub, xpub, ypub, zpub, zpub]

const sampleMainnetExternalDescriptors = [
  `pkh([${fingerprint}/44'/${coinTypeMainnet}'/${account}']${xpub}/0/*)`,
  `sh(wpkh([${fingerprint}/49'/${coinTypeMainnet}'/${account}']${ypub}/0/*))`,
  `wpkh([${fingerprint}/84'/${coinTypeMainnet}'/${account}']${zpub}/0/*)`,
  `sh([${fingerprint}/45'/${coinTypeMainnet}'/${account}']${xpub}/0/*)`,
  `sh(wsh([${fingerprint}/48'/${coinTypeMainnet}'/${account}'/1']${ypub}/0/*))`,
  `wsh([${fingerprint}/48'/${coinTypeMainnet}'/${account}'/2']${zpub}/0/*)`,
  `tr([${fingerprint}/86'/${coinTypeMainnet}'/${account}']${zpub}/0/*)`
]

const sampleMainnetInternalDescriptors = sampleMainnetExternalDescriptors.map(
  (descriptor) => descriptor.replace('0/*', '1/*')
)

const sampleTestnetKeys = [tpub, upub, vpub, tpub, upub, vpub, vpub]

const sampleTestnetExternalDescriptors = [
  `pkh([${fingerprint}/44'/${coinTypeTestnet}'/${account}']${tpub}/0/*)`,
  `sh(wpkh([${fingerprint}/49'/${coinTypeTestnet}'/${account}']${upub}/0/*))`,
  `wpkh([${fingerprint}/84'/${coinTypeTestnet}'/${account}']${vpub}/0/*)`,
  `sh([${fingerprint}/45'/${coinTypeTestnet}'/${account}']${tpub}/0/*)`,
  `sh(wsh([${fingerprint}/48'/${coinTypeTestnet}'/${account}'/1']${upub}/0/*))`,
  `wsh([${fingerprint}/48'/${coinTypeTestnet}'/${account}'/2']${vpub}/0/*)`,
  `tr([${fingerprint}/86'/${coinTypeTestnet}'/${account}']${vpub}/0/*)`
]

const sampleTestnetInternalDescriptors = sampleTestnetExternalDescriptors.map(
  (descriptor) => descriptor.replace('0/*', '1/*')
)

const sampleDescriptorsScriptVersion: ScriptVersionType[] = [
  'P2PKH',
  'P2SH-P2WPKH',
  'P2WPKH',
  'P2SH',
  'P2SH-P2WSH',
  'P2WSH',
  'P2TR'
]

const descriptorCount = 7

describe('bip32 descriptor utils', () => {
  it('Gets extended key from descriptor (mainnet)', () => {
    for (let i = 0; i < descriptorCount; i += 1) {
      const key = sampleMainnetKeys[i]
      const externalDescriptor = sampleMainnetExternalDescriptors[i]
      const internalDescriptor = sampleMainnetInternalDescriptors[i]
      expect(getExtendedKeyFromDescriptor(externalDescriptor)).toEqual(key)
      expect(getExtendedKeyFromDescriptor(internalDescriptor)).toEqual(key)
    }
  })

  it('Gets extended key from descriptor (testnet)', () => {
    for (let i = 0; i < descriptorCount; i += 1) {
      const key = sampleTestnetKeys[i]
      const externalDescriptor = sampleTestnetExternalDescriptors[i]
      const internalDescriptor = sampleTestnetInternalDescriptors[i]
      expect(getExtendedKeyFromDescriptor(externalDescriptor)).toEqual(key)
      expect(getExtendedKeyFromDescriptor(internalDescriptor)).toEqual(key)
    }
  })

  it('Gets descriptor from extended key (mainnet)', () => {
    for (let i = 0; i < descriptorCount; i += 1) {
      const key = sampleMainnetKeys[i]
      const scriptVersion = sampleDescriptorsScriptVersion[i]
      const network = BDKNetwork.Bitcoin
      const externalDescriptor = sampleMainnetExternalDescriptors[i]
      const internalDescriptor = sampleMainnetInternalDescriptors[i]
      const result = getDescriptorsFromKey(
        key,
        fingerprint,
        scriptVersion,
        network
      )
      expect(result.externalDescriptor).toEqual(externalDescriptor)
      expect(result.internalDescriptor).toEqual(internalDescriptor)
    }
  })

  it('Gets descriptor from extended key (testnet)', () => {
    for (let i = 0; i < descriptorCount; i += 1) {
      const key = sampleTestnetKeys[i]
      const scriptVersion = sampleDescriptorsScriptVersion[i]
      const network = BDKNetwork.Testnet
      const externalDescriptor = sampleTestnetExternalDescriptors[i]
      const internalDescriptor = sampleTestnetInternalDescriptors[i]
      const result = getDescriptorsFromKey(
        key,
        fingerprint,
        scriptVersion,
        network
      )
      expect(result.externalDescriptor).toEqual(externalDescriptor)
      expect(result.internalDescriptor).toEqual(internalDescriptor)
    }
  })
})
