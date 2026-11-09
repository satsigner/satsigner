import { router } from 'expo-router'

import { HOME_ROUTE, LAST_ROUTE_STORAGE_KEY } from '@/constants/navigation'
import { deleteItem, getItem, setItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useArkStore } from '@/store/ark'
import { useAuthStore } from '@/store/auth'
import { useEcashStore } from '@/store/ecash'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { useSettingsStore } from '@/store/settings'
import {
  isAuthenticatedRoute,
  isRestorableRoute,
  type LastRoute,
  parseHref,
  type RouteOwnership,
  routeFromSegments,
  serializeHref
} from '@/utils/lastRoute'

const WARNING_ROUTE = '/warning'

type CurrentRoute = {
  segments: readonly string[]
  searchParams: Parameters<typeof routeFromSegments>[1]
}

function clearLastRoute(): Promise<void> {
  return deleteItem(LAST_ROUTE_STORAGE_KEY).catch(() => undefined)
}

/**
 * Kept in SecureStore, not MMKV: route params carry txids, addresses and
 * npubs. Screens outside the authenticated session (unlock, setPin) leave the
 * stored route alone so backgrounding the PIN screen does not overwrite it.
 */
async function saveLastRoute({ segments, searchParams }: CurrentRoute) {
  if (!useSettingsStore.getState().reopenLastScreen) {
    await clearLastRoute()
    return
  }
  if (!isAuthenticatedRoute(segments)) {
    return
  }
  const route = routeFromSegments(segments, searchParams)
  await setItem(LAST_ROUTE_STORAGE_KEY, serializeHref(route)).catch(
    () => undefined
  )
}

function getRouteOwnership(): RouteOwnership {
  return {
    accountIds: useAccountsStore.getState().accounts.map(({ id }) => id),
    arkAccountIds: useArkStore.getState().accounts.map(({ id }) => id),
    ecashAccountIds: useEcashStore.getState().accounts.map(({ id }) => id),
    identityNpubs: useNostrIdentityStore
      .getState()
      .identities.map(({ npub }) => npub)
  }
}

/**
 * Reads and clears the stored route. A pending backup restore replaces the
 * accounts after unlock, so a route into them is dropped too.
 */
async function takeRestorableLastRoute(): Promise<LastRoute | null> {
  const raw = await getItem(LAST_ROUTE_STORAGE_KEY).catch(() => null)
  await clearLastRoute()
  if (!useSettingsStore.getState().reopenLastScreen) {
    return null
  }
  if (useAuthStore.getState().pendingRecoverData) {
    return null
  }
  const route = parseHref(raw)
  if (!route || !isRestorableRoute(route, getRouteOwnership())) {
    return null
  }
  return route
}

/** Home sits under the reopened screen, so back still leads home. */
async function navigateAfterUnlock(showWarning: boolean) {
  if (showWarning) {
    await clearLastRoute()
    router.replace(WARNING_ROUTE)
    return
  }
  const route = await takeRestorableLastRoute()
  router.replace(HOME_ROUTE)
  if (route) {
    router.push(route)
  }
}

/**
 * The skipped PIN path never leaves the current screen on a warm resume, so
 * only a fresh start at home reopens the stored route.
 */
async function restoreLastRouteAfterSkippedPin() {
  if (router.canGoBack()) {
    return
  }
  const route = await takeRestorableLastRoute()
  if (route) {
    router.push(route)
  }
}

export {
  clearLastRoute,
  navigateAfterUnlock,
  restoreLastRouteAfterSkippedPin,
  saveLastRoute
}
