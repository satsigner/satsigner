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
