import { KeychainKind } from 'react-native-bdk-sdk'

import { peekDerivedAddress } from '@/utils/derivedAddress'

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
