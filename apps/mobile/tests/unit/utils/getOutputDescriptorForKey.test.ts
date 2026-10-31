import type { Key, Secret } from '@/types/models/Account'
import { getDescriptorsFromKey } from '@/utils/bip32'
import {
  getExtendedPublicKeyFromMnemonic,
  getFingerprintFromMnemonic
} from '@/utils/bip39'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import {
  getOutputDescriptorStringForKey,
  resolveDescriptorForNostrCommonKeys
} from '@/utils/getOutputDescriptorForKey'
import { deriveNostrKeysFromDescriptor } from '@/utils/nostr'

const DESCRIPTOR =
  "wpkh([60c6c741/84'/1'/0']tpubDDSsu3cncmRPe7hd3TYa419HMeHkdhGKNmUA17dDfyUogBE5pRKDPV14reDahCasFuJK9Zrnb9NXchBXCjhzgxRJgd5XHrVumiiqaTSwedx/0/*)#113CZT8y"
const MNEMONIC =
  'visa toddler sentence rival twin believe report person library security stadium hurt'

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

  it('wraps a stored bare multisig key in pk()', async () => {
    const key = baseKey({
      creationType: 'generateMnemonic',
      scriptVersion: 'P2WSH'
    })
    const keyExpression =
      "[e5eda689/48'/1'/0'/2']tpubDDSsu3cncmRPe7hd3TYa419HMeHkdhGKNmUA17dDfyUogBE5pRKDPV14reDahCasFuJK9Zrnb9NXchBXCjhzgxRJgd5XHrVumiiqaTSwedx/0/*"
    const secret: Secret = { externalDescriptor: `wsh(${keyExpression})` }
    await expect(
      getOutputDescriptorStringForKey(key, secret, 'testnet')
    ).resolves.toBe(`wsh(pk(${keyExpression}))`)
  })

  it('builds a pk() descriptor for a multisig extended public key', async () => {
    const key = baseKey({
      creationType: 'importExtendedPub',
      scriptVersion: 'P2SH-P2WSH'
    })
    const secret: Secret = { extendedPublicKey: 'tpubKEY' }
    await expect(
      getOutputDescriptorStringForKey(key, secret, 'testnet')
    ).resolves.toBe('sh(wsh(pk(tpubKEY/0/*)))')
  })

  it.each(['P2WSH', 'P2SH-P2WSH', 'P2SH'] as const)(
    'matches a generated key for an imported %s multisig mnemonic',
    async (scriptVersion) => {
      const bdkNetwork = appNetworkToBdkNetwork('testnet')
      const extendedPublicKey = getExtendedPublicKeyFromMnemonic(
        MNEMONIC,
        '',
        bdkNetwork,
        scriptVersion
      )
      const fingerprint = getFingerprintFromMnemonic(MNEMONIC)
      const key = baseKey({ creationType: 'importMnemonic', scriptVersion })
      const secret: Secret = {
        extendedPublicKey,
        fingerprint,
        mnemonic: MNEMONIC
      }
      const { externalDescriptor } = getDescriptorsFromKey(
        extendedPublicKey,
        fingerprint,
        scriptVersion,
        bdkNetwork,
        true
      )

      await expect(
        getOutputDescriptorStringForKey(key, secret, 'testnet')
      ).resolves.toBe(externalDescriptor)
    }
  )

  it('falls back to the extended public key once the seed is dropped', async () => {
    const key = baseKey({
      creationType: 'importMnemonic',
      scriptVersion: 'P2WSH'
    })
    const secret: Secret = {
      extendedPublicKey: 'tpubKEY',
      fingerprint: 'e5eda689'
    }
    await expect(
      getOutputDescriptorStringForKey(key, secret, 'testnet')
    ).resolves.toBe("wsh(pk([e5eda689/48'/1'/0'/2']tpubKEY/0/*))")
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
