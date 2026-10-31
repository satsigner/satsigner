import {
  backupKeySecretFields,
  hasBackupKeySecret,
  secretFromBackupKey
} from '@/utils/keyBackup'
import { publicDescriptorFromPrivateKey } from '@/utils/wif'

const PRIVATE_KEY_HEX =
  '0c28fca386c7a227600b2fe50b7cae11ec86d3bf1fbe471be89827e19d72aa1d'
const MNEMONIC = 'abandon abandon abandon'

describe('backupKeySecretFields', () => {
  it('keeps the seed words and passphrase of a mnemonic key', () => {
    expect(
      backupKeySecretFields({
        externalDescriptor: 'wpkh(xpub)',
        fingerprint: '00000000',
        mnemonic: MNEMONIC,
        passphrase: 'pass'
      })
    ).toStrictEqual({ passphrase: 'pass', seedWords: MNEMONIC })
  })

  it('keeps the private key of a WIF key', () => {
    expect(
      backupKeySecretFields({
        externalDescriptor: 'wpkh(02ab)',
        privateKey: PRIVATE_KEY_HEX,
        privateKeyCompressed: false
      })
    ).toStrictEqual({
      privateKey: PRIVATE_KEY_HEX,
      privateKeyCompressed: false
    })
  })

  it('carries nothing for a watch-only key', () => {
    expect(backupKeySecretFields({ extendedPublicKey: 'xpub' })).toStrictEqual(
      {}
    )
  })
})

describe('hasBackupKeySecret', () => {
  it('accepts a key with seed words, a passphrase, or a private key', () => {
    expect(hasBackupKeySecret({ seedWords: MNEMONIC })).toBe(true)
    expect(hasBackupKeySecret({ passphrase: '' })).toBe(true)
    expect(hasBackupKeySecret({ privateKey: PRIVATE_KEY_HEX })).toBe(true)
  })

  it('refuses a key without secret data', () => {
    expect(hasBackupKeySecret({ index: 0, name: 'k1' })).toBe(false)
  })
})

describe('secretFromBackupKey', () => {
  it('rebuilds a mnemonic secret', () => {
    expect(
      secretFromBackupKey({
        creationType: 'importMnemonic',
        passphrase: 'pass',
        seedWords: MNEMONIC
      })
    ).toStrictEqual({ mnemonic: MNEMONIC, passphrase: 'pass' })
  })

  it('rebuilds the same secret a WIF import stores', () => {
    expect(
      secretFromBackupKey({
        creationType: 'importWif',
        privateKey: PRIVATE_KEY_HEX,
        privateKeyCompressed: true,
        scriptVersion: 'P2TR'
      })
    ).toStrictEqual({
      externalDescriptor: publicDescriptorFromPrivateKey(
        PRIVATE_KEY_HEX,
        true,
        'P2TR'
      ),
      privateKey: PRIVATE_KEY_HEX,
      privateKeyCompressed: true
    })
  })

  it.each([
    ['zero', '00'.repeat(32)],
    ['too short', PRIVATE_KEY_HEX.slice(2)],
    ['not hex', 'zz'.repeat(32)]
  ])('refuses a WIF key whose private key is %s', (_, privateKey) => {
    expect(
      secretFromBackupKey({
        creationType: 'importWif',
        privateKey,
        privateKeyCompressed: true,
        scriptVersion: 'P2WPKH'
      })
    ).toBeUndefined()
  })

  it('refuses a WIF key without a script the key allows', () => {
    expect(
      secretFromBackupKey({
        creationType: 'importWif',
        privateKey: PRIVATE_KEY_HEX,
        privateKeyCompressed: false,
        scriptVersion: 'P2WPKH'
      })
    ).toBeUndefined()
    expect(
      secretFromBackupKey({
        creationType: 'importWif',
        privateKey: PRIVATE_KEY_HEX,
        privateKeyCompressed: true
      })
    ).toBeUndefined()
  })

  it('refuses a key without secret data', () => {
    expect(
      secretFromBackupKey({ creationType: 'importMnemonic' })
    ).toBeUndefined()
  })
})
