import NetInfo from '@react-native-community/netinfo'
import { AppState } from 'react-native'

import { reconnectNdkForRelays } from '@/api/nostr'
import {
  getNostrLifecycleDiagnostics,
  registerNostrLifecycleHandler,
  resumeNostr,
  startNostrLifecycle,
  stopNostrLifecycle
} from '@/utils/nostrLifecycle'
import { nostrSyncService } from '@/utils/nostrSyncService'

const mockAccountsState = {
  accounts: [
    {
      id: 'account-1',
      nostr: {
        autoSync: true,
        commonNpub: 'npub1common',
        commonNsec: 'nsec1common',
        deviceNpub: 'npub1device',
        deviceNsec: 'nsec1device',
        relays: ['wss://relay.test']
      }
    }
  ]
}

const mockNostrState: {
  syncStatus: Record<string, { status: string }>
} = { syncStatus: {} }

jest.mock<typeof import('@/store/nostr')>('@/store/nostr', () => ({
  useNostrStore: { getState: () => mockNostrState }
}))

jest.mock<typeof import('@react-native-community/netinfo')>(
  '@react-native-community/netinfo',
  () => ({
    addEventListener: jest.fn(() => jest.fn())
  })
)

jest.mock<typeof import('@/api/nostr')>('@/api/nostr', () => ({
  reconnectNdkForRelays: jest.fn().mockResolvedValue(undefined)
}))

jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => ({
  useAccountsStore: { getState: () => mockAccountsState }
}))

jest.mock<typeof import('@/utils/nostrSyncService')>(
  '@/utils/nostrSyncService',
  () => ({
    isReadyForSync: (account?: { nostr?: { autoSync?: boolean } }) =>
      Boolean(account?.nostr?.autoSync),
    nostrSyncService: {
      getActiveAccountIds: jest.fn(() => ['account-1']),
      hasActiveSubscription: jest.fn().mockReturnValue(false),
      restartSync: jest.fn().mockResolvedValue(undefined)
    }
  })
)

function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve)
  })
}

describe('nostrLifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockNostrState.syncStatus = {}
    jest
      .mocked(nostrSyncService.getActiveAccountIds)
      .mockReturnValue(['account-1'])
  })

  afterEach(() => {
    stopNostrLifecycle()
  })

  // NDK re-opens a dropped socket without re-sending running REQs, so a live
  // looking sync is re-subscribed too.
  it('re-subscribes every live account sync on resume from its cursor', async () => {
    await resumeNostr()

    expect(reconnectNdkForRelays).toHaveBeenCalledWith(['wss://relay.test'])
    expect(nostrSyncService.restartSync).toHaveBeenCalledWith('account-1')
    expect(getNostrLifecycleDiagnostics().lastResume).toMatchObject({
      restartedAccountIds: ['account-1']
    })
  })

  it('restarts an account whose sync gave up after its retries', async () => {
    jest.mocked(nostrSyncService.getActiveAccountIds).mockReturnValue([])
    mockNostrState.syncStatus = { 'account-1': { status: 'error' } }

    await resumeNostr()

    expect(nostrSyncService.restartSync).toHaveBeenCalledWith('account-1')
  })

  it('notifies registered handlers on resume and background', async () => {
    const onActive = jest.fn()
    const onBackground = jest.fn()
    const unregister = registerNostrLifecycleHandler({ onActive, onBackground })
    const appStateListener = jest.spyOn(AppState, 'addEventListener')

    startNostrLifecycle()
    const [[, onChange]] = appStateListener.mock.calls
    onChange('background')
    onChange('active')
    await Promise.resolve()
    unregister()
    await resumeNostr()

    expect(onBackground).toHaveBeenCalledTimes(1)
    expect(onActive).toHaveBeenCalledTimes(1)
  })

  it('registers its listeners once and resumes when back online', async () => {
    startNostrLifecycle()
    startNostrLifecycle()

    expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1)
    const [[onConnectivity]] = jest.mocked(NetInfo.addEventListener).mock.calls
    onConnectivity({ isConnected: false })
    onConnectivity({ isConnected: true })
    await flushPromises()

    expect(nostrSyncService.restartSync).toHaveBeenCalledWith('account-1')
  })
})
