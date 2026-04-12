import type { Key, Secret } from '@/types/models/Account'
import {
  getOutputDescriptorStringForKey,
  resolveDescriptorForNostrCommonKeys
} from '@/utils/getOutputDescriptorForKey'

const DESCRIPTOR =
  "wpkh([60c6c741/84'/1'/0']tpubDDSsu3cncmRPe7hd3TYa419HMeHkdhGKNmUA17dDfyUogBE5pRKDPV14reDahCasFuJK9Zrnb9NXchBXCjhzgxRJgd5XHrVumiiqaTSwedx/0/*)#113CZT8y"

function baseKey(overrides: Partial<Key> = {}): Key {
  return {
    creationType: 'importDescriptor',
    index: 0,
    iv: '',
    secret: {},
    ...overrides
  }
}

describe('getOutputDescriptorStringForKey', () => {
  it('returns stored external descriptor for importDescriptor', () => {
    const key = baseKey({ scriptVersion: 'P2WPKH' })
    const secret: Secret = { externalDescriptor: DESCRIPTOR }
    expect(
      getOutputDescriptorStringForKey(key, secret, 'testnet')
    ).toStrictEqual(DESCRIPTOR)
  })

  it('returns empty for unsupported creation types', () => {
    const key = baseKey({ creationType: 'importAddress' })
    const secret: Secret = {}
    expect(getOutputDescriptorStringForKey(key, secret, 'testnet')).toBe('')
  })
})

describe('resolveDescriptorForNostrCommonKeys', () => {
  it('prefers export-style descriptor over BDK wallet string for singlesig', () => {
    const account = {
      network: 'testnet' as const,
      policyType: 'singlesig' as const
    }

    const key = baseKey({
      creationType: 'importMnemonic',
      scriptVersion: 'P2WPKH',
      secret: {}
    })
    const secret: Secret = { externalDescriptor: DESCRIPTOR }

    const xprvWallet =
      'wpkh([fingerprint/84h/1h/0h]xprv9s21ZrQH143Kfake/0/*)#abc'

    expect(
      resolveDescriptorForNostrCommonKeys(account, key, secret, {
        externalDescriptor: xprvWallet
      })
    ).toBe(DESCRIPTOR)
  })

  it('uses wallet policy descriptor for multisig', () => {
    const account = {
      network: 'testnet' as const,
      policyType: 'multisig' as const
    }

    const key = baseKey()
    const secret: Secret = { externalDescriptor: DESCRIPTOR }

    const multisig =
      'wsh(sortedmulti(1,[a/48h/1h/0h/2h]tpubAAA/<0;1>/*,[b/48h/1h/0h/2h]tpubBBB/<0;1>/*))#ms'

    expect(
      resolveDescriptorForNostrCommonKeys(account, key, secret, {
        externalDescriptor: multisig
      })
    ).toBe(multisig)
  })

  it('falls back to secret external descriptor for multisig when wallet missing', () => {
    const account = {
      network: 'testnet' as const,
      policyType: 'multisig' as const
    }

    const key = baseKey()
    const secret: Secret = { externalDescriptor: DESCRIPTOR }

    expect(
      resolveDescriptorForNostrCommonKeys(account, key, secret, undefined)
    ).toBe(DESCRIPTOR)
  })
})
