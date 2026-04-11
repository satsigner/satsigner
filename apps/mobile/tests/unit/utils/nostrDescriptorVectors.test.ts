import { createHash } from 'crypto'

import { t } from '@/locales'
import { parseDescriptor } from '@/utils/parse'

/**
 * Mirrors `deriveNostrKeysFromDescriptor` preimage + hashing only (Node crypto).
 * We assert the 32-byte secret hex so tests do not need real `nostr-tools`
 * (Jest uses a stub `nostr-tools` mock elsewhere that breaks bech32 vectors).
 *
 * Reference: `nip19.nsecEncode` of the testnet vector secret is
 * `nsec10cnckg8yvj8ctk78zsekgjz00x7qgxz6vyvp8q2ftw57pt6fx8nqa76l3r`.
 */
function deriveNostrSyncSecretHexFromDescriptor(
  externalDescriptor: string
): string {
  const { hardenedPath, xpubs } = parseDescriptor(externalDescriptor)
  if (xpubs.length === 0) {
    throw new Error(t('account.nostrSync.commonKeysDescriptorParseError'))
  }
  const totalString = `${hardenedPath}${xpubs.join('')}`
  const firstHash = createHash('sha256').update(totalString, 'utf8').digest('hex')
  return createHash('sha256').update(firstHash, 'utf8').digest('hex')
}

describe('Nostr sync key from descriptor (crypto vectors)', () => {
  it('derives a stable 32-byte secret for testnet wpkh + tpub', () => {
    const descriptor =
      "wpkh([60c6c741/84'/1'/0']tpubDDSsu3cncmRPe7hd3TYa419HMeHkdhGKNmUA17dDfyUogBE5pRKDPV14reDahCasFuJK9Zrnb9NXchBXCjhzgxRJgd5XHrVumiiqaTSwedx/0/*)#113CZT8y"
    expect(deriveNostrSyncSecretHexFromDescriptor(descriptor)).toBe(
      '7e278b20e4648f85dbc7143364484f79bc04185a61181381495ba9e0af4931e6'
    )
  })

  it('ignores /0/* vs /<0;1>/* suffix (same hardened path + xpub)', () => {
    const multipath =
      "wpkh([60c6c741/84'/1'/0']tpubDDSsu3cncmRPe7hd3TYa419HMeHkdhGKNmUA17dDfyUogBE5pRKDPV14reDahCasFuJK9Zrnb9NXchBXCjhzgxRJgd5XHrVumiiqaTSwedx/<0;1>/*)#3qsy06cj"
    const external =
      "wpkh([60c6c741/84'/1'/0']tpubDDSsu3cncmRPe7hd3TYa419HMeHkdhGKNmUA17dDfyUogBE5pRKDPV14reDahCasFuJK9Zrnb9NXchBXCjhzgxRJgd5XHrVumiiqaTSwedx/0/*)#113CZT8y"
    expect(deriveNostrSyncSecretHexFromDescriptor(multipath)).toBe(
      deriveNostrSyncSecretHexFromDescriptor(external)
    )
  })

  it('rejects descriptors with no extended public key', () => {
    expect(() =>
      deriveNostrSyncSecretHexFromDescriptor(
        "wpkh([73c5da0a/84'/1'/0']/0/*)#deadbeef"
      )
    ).toThrow(/could not read an xpub/i)
  })
})
