import { KeychainKind } from 'react-native-bdk-sdk'

import {
  findFirstUnusedExternalAddress,
  peekDerivedAddress
} from '@/utils/derivedAddress'

function rangedWallet() {
  return {
    peekAddress: jest.fn((keychain: KeychainKind, index: number) => ({
      address: `addr-${index}`,
      index,
      keychain
    }))
  }
}

function singleScriptWallet() {
  return {
    peekAddress: jest.fn((keychain: KeychainKind) => ({
      address: 'only-addr',
      index: 0,
      keychain
    }))
  }
}

describe('peekDerivedAddress', () => {
  it('returns the address at the requested index', () => {
    expect(
      peekDerivedAddress(rangedWallet(), KeychainKind.External, 3)
    ).toStrictEqual({
      address: 'addr-3',
      index: 3,
      keychain: KeychainKind.External
    })
  })

  it('returns the one address of a descriptor without a wildcard at index 0', () => {
    expect(
      peekDerivedAddress(singleScriptWallet(), KeychainKind.External, 0)
    ).toStrictEqual({
      address: 'only-addr',
      index: 0,
      keychain: KeychainKind.External
    })
  })

  it('returns nothing past the one address of a descriptor without a wildcard', () => {
    expect(
      peekDerivedAddress(singleScriptWallet(), KeychainKind.Internal, 1)
    ).toBeUndefined()
  })
})

describe('findFirstUnusedExternalAddress', () => {
  it('returns index 0 when nothing is used', () => {
    expect(
      findFirstUnusedExternalAddress(rangedWallet(), new Set())?.index
    ).toBe(0)
  })

  it('skips used addresses', () => {
    const used = new Set(['addr-0', 'addr-1', 'addr-3'])
    expect(findFirstUnusedExternalAddress(rangedWallet(), used)?.address).toBe(
      'addr-2'
    )
  })

  it('ignores used addresses that belong to another wallet', () => {
    const used = new Set(['elsewhere-1', 'elsewhere-2'])
    expect(findFirstUnusedExternalAddress(rangedWallet(), used)?.address).toBe(
      'addr-0'
    )
  })

  it('reuses the only address of a descriptor without a wildcard', () => {
    expect(
      findFirstUnusedExternalAddress(singleScriptWallet(), new Set())?.address
    ).toBe('only-addr')
  })

  it('returns nothing once a single-address keychain is used', () => {
    expect(
      findFirstUnusedExternalAddress(
        singleScriptWallet(),
        new Set(['only-addr'])
      )
    ).toBeUndefined()
  })
})
