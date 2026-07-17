import type { Key, Secret } from '@/types/models/Account'
import {
  getOutputDescriptorStringForKey,
  resolveDescriptorForNostrCommonKeys
} from '@/utils/getOutputDescriptorForKey'
import { deriveNostrKeysFromDescriptor } from '@/utils/nostr'

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
  it('returns stored external descriptor for importDescriptor', async () => {
    const key = baseKey({ scriptVersion: 'P2WPKH' })
    const secret: Secret = { externalDescriptor: DESCRIPTOR }
    await expect(
      getOutputDescriptorStringForKey(key, secret, 'testnet')
    ).resolves.toStrictEqual(DESCRIPTOR)
  })

  it('returns empty for unsupported creation types', async () => {
    const key = baseKey({ creationType: 'importAddress' })
    const secret: Secret = {}
    await expect(
      getOutputDescriptorStringForKey(key, secret, 'testnet')
    ).resolves.toBe('')
  })
})

describe('resolveDescriptorForNostrCommonKeys', () => {
  it('prefers export-style descriptor over BDK wallet string for singlesig', async () => {
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

    await expect(
      resolveDescriptorForNostrCommonKeys(account, key, secret, {
        externalDescriptor: xprvWallet
      })
    ).resolves.toBe(DESCRIPTOR)
  })

  it('uses wallet policy descriptor for multisig', async () => {
    const account = {
      network: 'testnet' as const,
      policyType: 'multisig' as const
    }

    const key = baseKey()
    const secret: Secret = { externalDescriptor: DESCRIPTOR }

    const multisig =
      'wsh(sortedmulti(1,[a/48h/1h/0h/2h]tpubAAA/<0;1>/*,[b/48h/1h/0h/2h]tpubBBB/<0;1>/*))#ms'

    await expect(
      resolveDescriptorForNostrCommonKeys(account, key, secret, {
        externalDescriptor: multisig
      })
    ).resolves.toBe(multisig)
  })

  it('falls back to secret external descriptor for multisig when wallet missing', async () => {
    const account = {
      network: 'testnet' as const,
      policyType: 'multisig' as const
    }

    const key = baseKey()
    const secret: Secret = { externalDescriptor: DESCRIPTOR }

    await expect(
      resolveDescriptorForNostrCommonKeys(account, key, secret, undefined)
    ).resolves.toBe(DESCRIPTOR)
  })

  it('builds an Electrum public descriptor for nostr shared keys', async () => {
    const account = {
      network: 'bitcoin' as const,
      policyType: 'singlesig' as const
    }
    const key = baseKey({
      creationType: 'importMnemonic',
      scriptVersion: 'P2WPKH'
    })
    const secret: Secret = {
      mnemonic:
        'love narrow noble little cat wonder daring drift absent lyrics noodle pudding'
    }

    const descriptor = await resolveDescriptorForNostrCommonKeys(
      account,
      key,
      secret,
      undefined
    )

    expect(descriptor).toMatch(/^wpkh\(\[e30a0cd1\/0'\]/)
    expect(descriptor).toMatch(/xpub/)

    const keys = await deriveNostrKeysFromDescriptor(descriptor)
    expect(keys.commonNsec).toMatch(/^nsec1/)
    expect(keys.commonNpub).toMatch(/^npub1/)
  })
})
