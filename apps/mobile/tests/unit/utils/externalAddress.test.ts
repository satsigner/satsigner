import { KeychainKind } from 'react-native-bdk-sdk'

import {
  findExternalAddressIndex,
  hasSingleExternalAddress,
  receiveAddressPath,
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

function singleScriptWallet(address: string) {
  return {
    peekAddress: jest.fn((keychain: KeychainKind) => ({
      address,
      index: 0,
      keychain
    }))
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

  it('stops after the one address of a descriptor without a wildcard', () => {
    const wallet = singleScriptWallet('wif-addr')
    expect(findExternalAddressIndex(wallet, 'wif-addr')).toBe(0)
    expect(findExternalAddressIndex(wallet, 'missing')).toBeUndefined()
    expect(wallet.peekAddress).toHaveBeenCalledTimes(3)
  })

  it('tells a single address keychain from a ranged one', () => {
    expect(hasSingleExternalAddress(singleScriptWallet('wif-addr'))).toBe(true)
    expect(hasSingleExternalAddress(mockWallet(['addr0', 'addr1']))).toBe(false)
  })

  it('builds no path for a key without a derivation path', () => {
    expect(receiveAddressPath(undefined, 0)).toBe('')
    expect(receiveAddressPath('', 0)).toBe('')
    expect(receiveAddressPath("m/84'/0'/0'", 4)).toBe("m/84'/0'/0'/0/4")
  })

  it('selects the one address of a WIF account without a path', () => {
    const selection = resolveReceiveAddressSelection({
      fallback: { address: 'wif-addr', index: 0 },
      wallet: singleScriptWallet('wif-addr')
    })

    expect(selection).toStrictEqual({
      address: 'wif-addr',
      index: 0,
      path: '',
      qrUri: 'bitcoin:wif-addr'
    })
  })
})
