import { useAuthStore } from '@/store/auth'
import { useEcashStore } from '@/store/ecash'
import { secureWipeAfterMaxPinTries } from '@/utils/secureWipe'

jest.mock<typeof import('@/db/mutations/accounts')>(
  '@/db/mutations/accounts',
  () => ({
    ...jest.requireActual<typeof import('@/db/mutations/accounts')>(
      '@/db/mutations/accounts'
    ),
    deleteAllAccounts: jest.fn()
  })
)

jest.mock<typeof import('@/db/mutations/tags')>(
  '@/db/mutations/tags',
  () => ({
    ...jest.requireActual<typeof import('@/db/mutations/tags')>(
      '@/db/mutations/tags'
    ),
    deleteTags: jest.fn()
  })
)

const PERSIST_FAILED = 'persist failed'

describe('secureWipeAfterMaxPinTries', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('keeps the PIN gate when the wipe rejects', async () => {
    useAuthStore.setState({
      firstTime: false,
      lockTriggered: true,
      pinTries: 3,
      requiresAuth: true
    })

    const originalGetState = useEcashStore.getState
    jest.spyOn(useEcashStore, 'getState').mockImplementation(() => ({
      ...originalGetState(),
      accounts: [],
      clearAllData: () => {
        throw new Error(PERSIST_FAILED)
      }
    }))

    await expect(secureWipeAfterMaxPinTries()).rejects.toThrow(PERSIST_FAILED)

    const auth = useAuthStore.getState()
    expect(auth.requiresAuth).toBe(true)
    expect(auth.firstTime).toBe(false)
    expect(auth.lockTriggered).toBe(true)
    expect(auth.pinTries).toBe(3)
  })
})
