import { router } from 'expo-router'
import { __store as secureStore } from 'expo-secure-store'

import { LAST_ROUTE_STORAGE_KEY } from '@/constants/navigation'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useSettingsStore } from '@/store/settings'
import type { Account } from '@/types/models/Account'
import { serializeHref } from '@/utils/lastRoute'
import {
  navigateAfterUnlock,
  restoreLastRouteAfterSkippedPin,
  saveLastRoute
} from '@/utils/lastRouteSession'

jest.mock<typeof import('expo-router')>('expo-router', () => ({
  router: { canGoBack: jest.fn(), push: jest.fn(), replace: jest.fn() }
}))
jest.mock<typeof import('@/store/accounts')>('@/store/accounts', () => {
  const { create: createStore } =
    jest.requireActual<typeof import('zustand')>('zustand')
  return {
    useAccountsStore: createStore<{ accounts: Pick<Account, 'id'>[] }>(() => ({
      accounts: []
    }))
  }
})

const ACCOUNT_ID = 'account-1'
const STORE_KEY = `1_${LAST_ROUTE_STORAGE_KEY}`
const ACCOUNT_SEGMENTS = [
  '(authenticated)',
  '(tabs)',
  '(signer,explorer,converter)',
  'signer',
  'bitcoin',
  'account',
  '[id]'
]
const ACCOUNT_ROUTE = {
  params: { id: ACCOUNT_ID },
  pathname: '/signer/bitcoin/account/[id]'
}

function storeRoute(route: {
  pathname: string
  params: Record<string, string>
}) {
  secureStore[STORE_KEY] = serializeHref(route)
}

describe('lastRouteSession', () => {
  beforeEach(() => {
    for (const key of Object.keys(secureStore)) {
      delete secureStore[key]
    }
    jest.clearAllMocks()
    useSettingsStore.setState({ reopenLastScreen: true })
    useAuthStore.setState({ pendingRecoverData: null })
    useAccountsStore.setState({
      accounts: [{ id: ACCOUNT_ID }]
    })
  })

  describe('saveLastRoute', () => {
    it('stores the current authenticated route', async () => {
      await saveLastRoute({
        searchParams: { id: ACCOUNT_ID },
        segments: ACCOUNT_SEGMENTS
      })

      expect(secureStore[STORE_KEY]).toBe(serializeHref(ACCOUNT_ROUTE))
    })

    it('keeps the stored route while the PIN screen is open', async () => {
      storeRoute(ACCOUNT_ROUTE)

      await saveLastRoute({ searchParams: {}, segments: ['unlock'] })

      expect(secureStore[STORE_KEY]).toBe(serializeHref(ACCOUNT_ROUTE))
    })

    it('drops the stored route when the setting is off', async () => {
      storeRoute(ACCOUNT_ROUTE)
      useSettingsStore.setState({ reopenLastScreen: false })

      await saveLastRoute({
        searchParams: { id: ACCOUNT_ID },
        segments: ACCOUNT_SEGMENTS
      })

      expect(secureStore[STORE_KEY]).toBeUndefined()
    })
  })

  describe('navigateAfterUnlock', () => {
    it('opens home, then the stored route, and forgets it', async () => {
      storeRoute(ACCOUNT_ROUTE)

      await navigateAfterUnlock(false)

      expect(router.replace).toHaveBeenCalledWith('/')
      expect(router.push).toHaveBeenCalledWith(ACCOUNT_ROUTE)
      expect(secureStore[STORE_KEY]).toBeUndefined()
    })

    it('opens the warning without restoring when it is due', async () => {
      storeRoute(ACCOUNT_ROUTE)

      await navigateAfterUnlock(true)

      expect(router.replace).toHaveBeenCalledWith('/warning')
      expect(router.push).not.toHaveBeenCalled()
      expect(secureStore[STORE_KEY]).toBeUndefined()
    })

    it('stays home when the setting is off', async () => {
      storeRoute(ACCOUNT_ROUTE)
      useSettingsStore.setState({ reopenLastScreen: false })

      await navigateAfterUnlock(false)

      expect(router.replace).toHaveBeenCalledWith('/')
      expect(router.push).not.toHaveBeenCalled()
    })

    it('stays home when the account is gone', async () => {
      storeRoute(ACCOUNT_ROUTE)
      useAccountsStore.setState({ accounts: [] })

      await navigateAfterUnlock(false)

      expect(router.push).not.toHaveBeenCalled()
    })

    it('stays home while a backup restore waits for this unlock', async () => {
      storeRoute(ACCOUNT_ROUTE)
      useAuthStore.setState({ pendingRecoverData: 'backup' })

      await navigateAfterUnlock(false)

      expect(router.push).not.toHaveBeenCalled()
    })

    it('stays home for a denylisted route', async () => {
      storeRoute({
        params: { id: ACCOUNT_ID },
        pathname: '/signer/bitcoin/account/[id]/signAndSend/ioPreview'
      })

      await navigateAfterUnlock(false)

      expect(router.push).not.toHaveBeenCalled()
    })
  })

  describe('restoreLastRouteAfterSkippedPin', () => {
    it('reopens the stored route on a fresh start', async () => {
      storeRoute(ACCOUNT_ROUTE)
      jest.mocked(router.canGoBack).mockReturnValue(false)

      await restoreLastRouteAfterSkippedPin()

      expect(router.push).toHaveBeenCalledWith(ACCOUNT_ROUTE)
    })

    it('leaves a resumed screen alone', async () => {
      storeRoute(ACCOUNT_ROUTE)
      jest.mocked(router.canGoBack).mockReturnValue(true)

      await restoreLastRouteAfterSkippedPin()

      expect(router.push).not.toHaveBeenCalled()
    })
  })
})
