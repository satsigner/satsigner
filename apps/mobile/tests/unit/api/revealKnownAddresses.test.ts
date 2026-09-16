import { KeychainKind } from 'react-native-bdk-sdk'

import { maxCoreKeychainIndex, revealKnownAddresses } from '@/api/bdk'
import { type Account } from '@/types/models/Account'

jest.mock<typeof import('@/utils/bip39')>('@/utils/bip39', () => ({
  detectElectrumSeed: jest.fn(() => null),
  getPrivateDescriptorFromElectrumMnemonic: jest.fn(),
  getPrivateDescriptorFromMnemonic: jest.fn(),
  mnemonicToSeed: jest.fn(() => new Uint8Array())
}))

jest.mock<typeof import('@/api/electrum')>('@/api/electrum', () => ({
  default: {} as unknown as typeof import('@/api/electrum').default
}))

const STOP_GAP = 20

function addressAt(index: number, keychain: 'external' | 'internal') {
  return {
    address: `addr-${keychain}-${index}`,
    index,
    keychain,
    label: '',
    summary: { balance: 0, satsInMempool: 0, transactions: 0, utxos: 0 },
    transactions: [] as string[],
    utxos: [] as string[]
  }
}

function makeWallet(nextExternal: number, nextInternal: number) {
  const nextByKind = {
    [KeychainKind.External]: nextExternal,
    [KeychainKind.Internal]: nextInternal
  }

  return {
    nextDerivationIndex: jest.fn((kind: KeychainKind) => nextByKind[kind]),
    persist: jest.fn(),
    revealNextAddress: jest.fn((kind: KeychainKind) => {
      nextByKind[kind] += 1
      return {
        address: 'revealed',
        index: nextByKind[kind] - 1,
        keychain: kind
      }
    })
  }
}

describe('revealKnownAddresses', () => {
  it('reveals through last used plus stopGap on both keychains', () => {
    const wallet = makeWallet(0, 0)
    const account = {
      addresses: [addressAt(5, 'external'), addressAt(2, 'internal')]
    } satisfies Pick<Account, 'addresses'>

    revealKnownAddresses(wallet, account, STOP_GAP)

    expect(wallet.revealNextAddress).toHaveBeenCalledTimes(
      5 + STOP_GAP + 1 + 2 + STOP_GAP + 1
    )
    expect(wallet.nextDerivationIndex(KeychainKind.External)).toBe(
      5 + STOP_GAP + 1
    )
    expect(wallet.nextDerivationIndex(KeychainKind.Internal)).toBe(
      2 + STOP_GAP + 1
    )
    expect(wallet.persist).toHaveBeenCalledTimes(1)
  })

  it('does not reveal when the account has no indexed addresses', () => {
    const wallet = makeWallet(0, 0)

    revealKnownAddresses(wallet, { addresses: [] }, STOP_GAP)

    expect(wallet.revealNextAddress).not.toHaveBeenCalled()
    expect(wallet.persist).toHaveBeenCalledTimes(1)
  })

  it('skips a keychain that is already revealed past last used plus stopGap', () => {
    const wallet = makeWallet(26, 0)
    const account = {
      addresses: [addressAt(5, 'external')]
    } satisfies Pick<Account, 'addresses'>

    revealKnownAddresses(wallet, account, STOP_GAP)

    expect(wallet.revealNextAddress).not.toHaveBeenCalled()
    expect(wallet.persist).toHaveBeenCalledTimes(1)
  })

  it('reveals through a Core-discovered index past stopGap and 999', () => {
    const wallet = makeWallet(0, 0)
    const coreMax = 1500
    const account = {
      addresses: [addressAt(5, 'external')]
    } satisfies Pick<Account, 'addresses'>

    revealKnownAddresses(wallet, account, STOP_GAP, {
      external: coreMax,
      internal: coreMax
    })

    expect(wallet.nextDerivationIndex(KeychainKind.External)).toBe(
      coreMax + STOP_GAP + 1
    )
    expect(wallet.nextDerivationIndex(KeychainKind.Internal)).toBe(
      coreMax + STOP_GAP + 1
    )
  })

  it('keeps last-used plus stopGap when Core has no higher index', () => {
    const wallet = makeWallet(0, 0)
    const account = {
      addresses: [addressAt(5, 'external'), addressAt(2, 'internal')]
    } satisfies Pick<Account, 'addresses'>

    revealKnownAddresses(wallet, account, STOP_GAP, {
      external: -1,
      internal: -1
    })

    expect(wallet.nextDerivationIndex(KeychainKind.External)).toBe(
      5 + STOP_GAP + 1
    )
    expect(wallet.nextDerivationIndex(KeychainKind.Internal)).toBe(
      2 + STOP_GAP + 1
    )
  })
})

describe('maxCoreKeychainIndex', () => {
  it('uses the higher of next_index-1 and range end per keychain', () => {
    const descriptors: Parameters<typeof maxCoreKeychainIndex>[0] = [
      { internal: false, next_index: 50, range: [0, 20] },
      { internal: true, next_index: 3, range: [0, 1500] }
    ]

    expect(maxCoreKeychainIndex(descriptors, false)).toBe(49)
    expect(maxCoreKeychainIndex(descriptors, true)).toBe(1500)
  })

  it('returns -1 when Core has no descriptors for that keychain', () => {
    expect(maxCoreKeychainIndex([], false)).toBe(-1)
    expect(
      maxCoreKeychainIndex(
        [{ internal: true, next_index: 10, range: [0, 20] }],
        false
      )
    ).toBe(-1)
  })
})
