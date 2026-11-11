import { useAccountBuilderStore } from '@/store/accountBuilder'

const MNEMONIC = 'abandon abandon about'

function addMnemonicKey(index: number) {
  const store = useAccountBuilderStore.getState()
  store.setCreationType('importMnemonic')
  store.setKeyName(`Key ${index + 1}`)
  store.setMnemonic(MNEMONIC)
  store.setFingerprint('abcdef12')
  return useAccountBuilderStore.getState().setKey(index)
}

describe('account builder keys', () => {
  beforeEach(() => {
    useAccountBuilderStore.getState().clearAccount()
  })

  it('updates the fingerprint on the key and on its secret', () => {
    addMnemonicKey(0)
    useAccountBuilderStore.getState().updateKeyFingerprint(0, '12345678')

    const [key] = useAccountBuilderStore.getState().keys
    expect(key.fingerprint).toBe('12345678')
    expect(key.secret).toStrictEqual(
      expect.objectContaining({ fingerprint: '12345678', mnemonic: MNEMONIC })
    )
  })

  it('ignores a fingerprint update for a missing key', () => {
    useAccountBuilderStore.getState().updateKeyFingerprint(3, '12345678')
    expect(useAccountBuilderStore.getState().keys).toStrictEqual([])
  })

  it('does not carry the previous key descriptors into the next key', () => {
    const store = useAccountBuilderStore.getState()
    store.setCreationType('generateMnemonic')
    store.setMnemonic(MNEMONIC)
    store.setFingerprint('abcdef12')
    store.setExtendedPublicKey('tpubKey1')
    store.setExternalDescriptor('wsh([abcdef12/48h/1h/0h/2h]tpubKey1/0/*)')
    store.setInternalDescriptor('wsh([abcdef12/48h/1h/0h/2h]tpubKey1/1/*)')
    store.setKey(0)
    store.clearKeyState()

    store.setCreationType('importExtendedPub')
    store.setFingerprint('12345678')
    store.setExtendedPublicKey('tpubKey2')
    const key = useAccountBuilderStore.getState().setKey(1)

    expect(key.secret).toStrictEqual({
      extendedPublicKey: 'tpubKey2',
      fingerprint: '12345678'
    })
  })

  it('drops a passphrase left from an earlier seed when a new one is generated', () => {
    const store = useAccountBuilderStore.getState()
    store.setCreationType('generateMnemonic')
    store.setPassphrase('qa')
    store.setGeneratedMnemonic(MNEMONIC, 'f280ded8')
    const key = useAccountBuilderStore.getState().setKey(0)

    expect(key.secret).toStrictEqual({
      fingerprint: 'f280ded8',
      mnemonic: MNEMONIC
    })
  })

  it('keeps a private key left from a failed WIF import out of a mnemonic key', () => {
    const store = useAccountBuilderStore.getState()
    store.setCreationType('importWif')
    store.setPrivateKey('ab'.repeat(32), true)

    const key = addMnemonicKey(0)

    expect(key.secret).toStrictEqual({
      fingerprint: 'abcdef12',
      mnemonic: MNEMONIC
    })
  })

  it('keeps a mnemonic left from an earlier seed out of a WIF key', () => {
    const store = useAccountBuilderStore.getState()
    store.setCreationType('generateMnemonic')
    store.setMnemonic(MNEMONIC)
    store.setPassphrase('qa')
    store.setFingerprint('f280ded8')

    store.setCreationType('importWif')
    store.setPrivateKey('ab'.repeat(32), true)
    store.setExternalDescriptor('wpkh(02aa)')
    const key = useAccountBuilderStore.getState().setKey(0)

    expect(key.secret).toStrictEqual({
      externalDescriptor: 'wpkh(02aa)',
      fingerprint: 'f280ded8',
      privateKey: 'ab'.repeat(32),
      privateKeyCompressed: true
    })
  })

  it('keeps seed data left in the draft out of a watch-only address key', () => {
    const store = useAccountBuilderStore.getState()
    store.setCreationType('importMnemonic')
    store.setMnemonic(MNEMONIC)
    store.setExtendedPublicKey('tpubKey1')

    store.setCreationType('importAddress')
    store.setFingerprint('')
    store.setExternalDescriptor('addr(bc1qexample)')
    const key = useAccountBuilderStore.getState().setKey(0)

    expect(key.secret).toStrictEqual({
      externalDescriptor: 'addr(bc1qexample)'
    })
  })

  it('resets only the chosen key slot', () => {
    addMnemonicKey(0)
    addMnemonicKey(1)
    useAccountBuilderStore.getState().resetKey(0)

    const { keys } = useAccountBuilderStore.getState()
    expect(keys[0]).toStrictEqual({
      creationType: undefined,
      fingerprint: undefined,
      index: 0,
      iv: '',
      mnemonicWordCount: undefined,
      name: '',
      scriptVersion: undefined,
      secret: ''
    })
    expect(keys[1].secret).toStrictEqual(
      expect.objectContaining({ mnemonic: MNEMONIC })
    )
  })
})

describe('account builder account data', () => {
  beforeEach(() => {
    useAccountBuilderStore.getState().clearAccount()
  })

  it('leaves a new account never synced', () => {
    addMnemonicKey(0)

    const account = useAccountBuilderStore.getState().getAccountData()

    expect(account.lastSyncedAt).toBeUndefined()
    expect(account.syncStatus).toBe('unsynced')
  })
})
