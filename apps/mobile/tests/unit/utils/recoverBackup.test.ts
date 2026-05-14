import { performRecoverOverwrite } from '@/utils/recoverBackup'

jest.mock<typeof import('@/utils/crypto')>('@/utils/crypto', () => ({
  aesEncrypt: jest.fn(),
  getPinForDecryption: jest.fn(),
  randomIv: jest.fn()
}))

jest.mock<typeof import('@/utils/nostrSyncService')>(
  '@/utils/nostrSyncService',
  () => ({
    resetInstance: jest.fn()
  })
)

jest.mock<typeof import('@/storage/encrypted')>('@/storage/encrypted', () => ({
  deleteEcashMnemonic: jest.fn(),
  storeEcashMnemonic: jest.fn(),
  storeKeySecret: jest.fn()
}))

jest.mock<typeof import('@/store/auth')>('@/store/auth', () => ({
  useAuthStore: { getState: jest.fn() }
}))

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: { getState: jest.fn(), setState: jest.fn() }
}))
jest.mock<typeof import('@/store/ark')>('@/store/ark', () => ({
  useArkStore: { getState: jest.fn(), setState: jest.fn() }
}))
jest.mock<typeof import('@/store/blockchain')>('@/store/blockchain', () => ({
  useBlockchainStore: { getState: jest.fn(), setState: jest.fn() }
}))
jest.mock<typeof import('@/store/ecash')>('@/store/ecash', () => ({
  useEcashStore: { getState: jest.fn(), setState: jest.fn() }
}))
jest.mock<typeof import('@/store/lightning')>('@/store/lightning', () => ({
  useLightningStore: { getState: jest.fn(), setState: jest.fn() }
}))
jest.mock<typeof import('@/store/nostr')>('@/store/nostr', () => ({
  useNostrStore: { getState: jest.fn(), setState: jest.fn() }
}))
jest.mock<typeof import('@/store/nostrIdentity')>(
  '@/store/nostrIdentity',
  () => ({
    useNostrIdentityStore: { getState: jest.fn(), setState: jest.fn() }
  })
)
jest.mock<typeof import('@/store/settings')>('@/store/settings', () => ({
  useSettingsStore: { getState: jest.fn(), setState: jest.fn() }
}))
jest.mock<typeof import('@/store/wallets')>('@/store/wallets', () => ({
  useWalletsStore: { getState: jest.fn(), setState: jest.fn() }
}))

const { getPinForDecryption } = jest.requireMock('@/utils/crypto') as {
  getPinForDecryption: jest.Mock
}
const { useAuthStore } = jest.requireMock('@/store/auth') as {
  useAuthStore: { getState: jest.Mock }
}

function setPin(pin: string | null) {
  useAuthStore.getState.mockReturnValue({ skipPin: false })
  getPinForDecryption.mockResolvedValue(pin)
}

describe('performRecoverOverwrite validation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fails when PIN is unavailable', async () => {
    setPin(null)
    const result = await performRecoverOverwrite('{}')
    expect(result).toStrictEqual({ error: 'PIN unavailable', success: false })
  })

  it('fails when payload is not valid JSON', async () => {
    setPin('1234')
    const result = (await performRecoverOverwrite('{not json')) as Extract<
      Awaited<ReturnType<typeof performRecoverOverwrite>>,
      { success: false }
    >
    expect(result.success).toBe(false)
    expect(result.error.length).toBeGreaterThan(0)
  })

  it('fails when payload is a JSON primitive (not object)', async () => {
    setPin('1234')
    const result = await performRecoverOverwrite('"a string"')
    expect(result).toStrictEqual({
      error: 'Backup payload is not an object',
      success: false
    })
  })

  it('fails when accounts array is missing', async () => {
    setPin('1234')
    const result = await performRecoverOverwrite(JSON.stringify({}))
    expect(result).toStrictEqual({
      error: 'Backup missing accounts array',
      success: false
    })
  })

  it('fails when accounts is not an array', async () => {
    setPin('1234')
    const result = await performRecoverOverwrite(
      JSON.stringify({ accounts: 'not an array' })
    )
    expect(result).toStrictEqual({
      error: 'Backup missing accounts array',
      success: false
    })
  })

  it('fails when an account is missing its keys array', async () => {
    setPin('1234')
    const result = await performRecoverOverwrite(
      JSON.stringify({ accounts: [{ id: 'x', name: 'A' }] })
    )
    expect(result).toStrictEqual({
      error: 'Backup account missing keys array',
      success: false
    })
  })

  it('fails when a key is missing both seedWords and passphrase', async () => {
    setPin('1234')
    const result = await performRecoverOverwrite(
      JSON.stringify({
        accounts: [
          {
            id: 'x',
            keys: [{ index: 0, name: 'k1' }],
            name: 'A'
          }
        ]
      })
    )
    expect(result).toStrictEqual({
      error: 'Backup key missing seed data',
      success: false
    })
  })

  it('does not invoke encryption or store mutations on validation failure', async () => {
    setPin('1234')
    const { aesEncrypt } = jest.requireMock('@/utils/crypto') as {
      aesEncrypt: jest.Mock
    }
    const { storeKeySecret } = jest.requireMock('@/storage/encrypted') as {
      storeKeySecret: jest.Mock
    }
    await performRecoverOverwrite('{not json')
    expect(aesEncrypt).not.toHaveBeenCalled()
    expect(storeKeySecret).not.toHaveBeenCalled()
  })
})
