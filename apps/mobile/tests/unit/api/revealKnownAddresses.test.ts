import { KeychainKind } from 'react-native-bdk-sdk'

import { revealKnownAddresses } from '@/api/bdk'
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
})
