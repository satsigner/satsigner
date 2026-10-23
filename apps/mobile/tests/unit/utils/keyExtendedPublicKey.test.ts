import { Network } from 'react-native-bdk-sdk'

import { type DecryptedKey } from '@/types/models/Account'
import { getExtendedPublicKeyFromMnemonic } from '@/utils/bip39'
import { getKeyExtendedPublicKey } from '@/utils/key'

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

function makeKey(
  secret: DecryptedKey['secret'],
  overrides: Partial<DecryptedKey> = {}
): DecryptedKey {
  return {
    creationType: 'importMnemonic',
    index: 0,
    iv: '',
    scriptVersion: 'P2WPKH',
    secret,
    ...overrides
  }
}

describe('getKeyExtendedPublicKey', () => {
  it('returns the stored extended public key', async () => {
    const key = makeKey({ extendedPublicKey: 'tpubStored', mnemonic: MNEMONIC })
    await expect(getKeyExtendedPublicKey(key, Network.Signet)).resolves.toBe(
      'tpubStored'
    )
  })

  it('derives the key from the mnemonic when only a private descriptor is stored', async () => {
    const key = makeKey({
      externalDescriptor: 'wpkh([73c5da0a/84h/1h/0h]tprv8ZgxMBicQKsP/0/*)',
      mnemonic: MNEMONIC
    })
    await expect(getKeyExtendedPublicKey(key, Network.Signet)).resolves.toBe(
      getExtendedPublicKeyFromMnemonic(MNEMONIC, '', Network.Signet, 'P2WPKH')
    )
  })

  it('reads the key from a public descriptor', async () => {
    const key = makeKey({
      externalDescriptor: 'wpkh([73c5da0a/84h/1h/0h]tpubDescriptorKey/0/*)'
    })
    await expect(getKeyExtendedPublicKey(key, Network.Signet)).resolves.toBe(
      'tpubDescriptorKey'
    )
  })

  it('returns an empty string without any public key material', async () => {
    const key = makeKey({ externalDescriptor: 'addr(tb1qexample)' })
    await expect(getKeyExtendedPublicKey(key, Network.Signet)).resolves.toBe('')
  })
})
