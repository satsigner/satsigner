import { getKeySecret } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import {
  commitPinMaterial,
  migratePinKdfIfNeeded,
  preparePinMaterial,
  recoverWorkingPinDigest
} from '@/utils/pinKdf'
import { setSessionPinDigest } from '@/utils/pinSession'
import {
  finalizePinAuthSuccess,
  getFirstEncryptedKeyProbe,
  promoteDuressPin
} from '@/utils/pinUnlock'

jest.mock<typeof import('@/storage/encrypted')>('@/storage/encrypted', () => ({
  getKeySecret: jest.fn()
}))

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: {
    getState: jest.fn()
  }
}))

jest.mock<typeof import('@/utils/pinKdf')>('@/utils/pinKdf', () => ({
  commitPinMaterial: jest.fn(),
  migratePinKdfIfNeeded: jest.fn(),
  preparePinMaterial: jest.fn(),
  recoverWorkingPinDigest: jest.fn()
}))

jest.mock<typeof import('@/utils/reEncryptPinSecrets')>(
  '@/utils/reEncryptPinSecrets',
  () => ({
    reEncryptPinBoundSecrets: jest.fn()
  })
)

jest.mock<typeof import('@/utils/pinSession')>('@/utils/pinSession', () => ({
  setSessionPinDigest: jest.fn()
}))

describe('getFirstEncryptedKeyProbe', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the first stored key secret', async () => {
    jest.mocked(useAccountsStore.getState).mockReturnValue({
      accounts: [{ id: 'acc-1', keys: [{}, {}] }]
    })
    jest
      .mocked(getKeySecret)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ iv: 'iv', secret: 'ciphertext' })

    await expect(getFirstEncryptedKeyProbe()).resolves.toStrictEqual({
      iv: 'iv',
      secret: 'ciphertext'
    })
  })

  it('returns null when no encrypted keys exist', async () => {
    jest.mocked(useAccountsStore.getState).mockReturnValue({ accounts: [] })
    await expect(getFirstEncryptedKeyProbe()).resolves.toBeNull()
  })
})

describe('finalizePinAuthSuccess', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useAccountsStore.getState).mockReturnValue({ accounts: [] })
    jest.mocked(migratePinKdfIfNeeded).mockResolvedValue(null)
    jest.mocked(recoverWorkingPinDigest).mockResolvedValue('digest')
  })

  it('rejects when onSuccess rejects', async () => {
    const onSuccess = jest.fn().mockRejectedValue(new Error('unlock failed'))

    await expect(
      finalizePinAuthSuccess('1234', 'salt', 'stored', onSuccess)
    ).rejects.toThrow('unlock failed')
    expect(recoverWorkingPinDigest).toHaveBeenCalledWith(
      '1234',
      'salt',
      'stored',
      null
    )
    expect(setSessionPinDigest).toHaveBeenCalledWith('digest')
  })

  it('upgrades the stored KDF and binds the upgraded digest', async () => {
    jest.mocked(migratePinKdfIfNeeded).mockResolvedValue('upgraded')
    jest.mocked(recoverWorkingPinDigest).mockResolvedValue('upgraded')
    const onSuccess = jest.fn().mockResolvedValue(undefined)

    await finalizePinAuthSuccess('1234', 'salt', 'stored', onSuccess)

    expect(migratePinKdfIfNeeded).toHaveBeenCalledWith(
      '1234',
      'salt',
      'stored',
      expect.any(Function)
    )
    expect(recoverWorkingPinDigest).toHaveBeenCalledWith(
      '1234',
      'salt',
      'upgraded',
      null
    )
    expect(setSessionPinDigest).toHaveBeenCalledWith('upgraded')
  })

  it('stays unlocked when the KDF upgrade throws', async () => {
    jest
      .mocked(migratePinKdfIfNeeded)
      .mockRejectedValue(new Error('migration failed'))
    const onSuccess = jest.fn().mockResolvedValue(undefined)

    await finalizePinAuthSuccess('1234', 'salt', 'stored', onSuccess)

    expect(recoverWorkingPinDigest).toHaveBeenCalledWith(
      '1234',
      'salt',
      'stored',
      null
    )
    expect(onSuccess).toHaveBeenCalledWith()
  })
})

describe('promoteDuressPin', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('stores the duress PIN as the main PIN and binds the session to it', async () => {
    const material = {
      digest: 'duress-digest',
      kdf: { iterations: 1, name: 'pbkdf2' },
      length: 4,
      salt: 'salt'
    }
    jest.mocked(preparePinMaterial).mockResolvedValue(material)

    await promoteDuressPin('9999')

    expect(preparePinMaterial).toHaveBeenCalledWith('9999')
    expect(commitPinMaterial).toHaveBeenCalledWith(material)
    expect(setSessionPinDigest).toHaveBeenCalledWith('duress-digest')
  })
})
