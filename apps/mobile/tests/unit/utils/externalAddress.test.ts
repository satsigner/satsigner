import { KeychainKind } from 'react-native-bdk-sdk'

import {
  findExternalAddressIndex,
  resolveReceiveAddressSelection
} from '@/utils/externalAddress'

function mockWallet(addresses: string[]) {
  return {
    peekAddress(keychain: KeychainKind, index: number) {
      if (keychain !== KeychainKind.External) {
        throw new Error('unexpected keychain')
      }
      const address = addresses[index]
      if (!address) {
        throw new Error('out of range')
      }
      return { address, index }
    }
  }
}

describe('externalAddress', () => {
  it('finds the external index for a known address', () => {
    const wallet = mockWallet(['addr0', 'addr1', 'addr2'])
    expect(findExternalAddressIndex(wallet, 'addr1')).toBe(1)
  })

  it('returns undefined when the address is not in range', () => {
    const wallet = mockWallet(['addr0'])
    expect(findExternalAddressIndex(wallet, 'missing')).toBeUndefined()
  })

  it('prefers a pinned payjoin address over first-unused fallback', () => {
    const wallet = mockWallet(['unused0', 'session1'])
    const selection = resolveReceiveAddressSelection({
      derivationPath: "m/84'/1'/0'",
      fallback: { address: 'unused0', index: 0 },
      preferredAddress: 'session1',
      wallet
    })

    expect(selection).toStrictEqual({
      address: 'session1',
      index: 1,
      path: "m/84'/1'/0'/0/1",
      qrUri: 'bitcoin:session1'
    })
  })

  it('uses the fallback index when preferred matches first-unused', () => {
    const wallet = mockWallet(['unused0', 'unused1'])
    const selection = resolveReceiveAddressSelection({
      derivationPath: "m/84'/1'/0'",
      fallback: { address: 'unused0', index: 0 },
      preferredAddress: 'unused0',
      wallet
    })

    expect(selection.address).toBe('unused0')
    expect(selection.index).toBe(0)
    expect(selection.path).toBe("m/84'/1'/0'/0/0")
  })
})
