import { useGlobalSearchParams, useRouter } from 'expo-router'
import Drawer from 'expo-router/drawer'
import {
  getFocusedRouteNameFromRoute,
  useRoute
} from 'expo-router/react-navigation'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useShallow } from 'zustand/react/shallow'

import { initRpcUrlAdjustments } from '@/api/rpc'
import SSArkReceiveOverlay from '@/components/SSArkReceiveOverlay'
import SSNavMenu from '@/components/SSNavMenu'
import SSPublicServerWarningModal from '@/components/SSPublicServerWarningModal'
import { pruneCache } from '@/db/nostrCache'
import { useArkExitWatcher } from '@/hooks/useArkExits'
import { useArkNotifications } from '@/hooks/useArkNotifications'
import { useArkSwapRunner } from '@/hooks/useArkSwaps'
import { useEcashPendingMintRunner } from '@/hooks/useEcashPendingMintRunner'
import { useFetchBitcoinPrice } from '@/hooks/useFetchBitcoinPrice'
import useSyncAccountWithAddress from '@/hooks/useSyncAccountWithAddress'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useBlockchainStore } from '@/store/blockchain'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import { useWalletsStore } from '@/store/wallets'
import type { Account } from '@/types/models/Account'
import { type PageParams, type PageRoute } from '@/types/navigation/page'
import { cancelAllAccountSyncs } from '@/utils/accountSyncRuns'
import { loadAccountWallets } from '@/utils/accountWallets'
import { devLog, devStep } from '@/utils/devConsole'
import { startNostrLifecycle, stopNostrLifecycle } from '@/utils/nostrLifecycle'
import { migrateAndHydrateNostrSecrets } from '@/utils/nostrSecrets'
import { performRecoverOverwrite } from '@/utils/recoverBackup'
import { showRecoverResultToast } from '@/utils/recoverToast'
import { migrateAndHydrateServiceSecrets } from '@/utils/serviceSecrets'
import { teardownUnlockedSessionSafe } from '@/utils/sessionTeardown'
import {
  type SyncErrorReporter,
  createSyncFailureBatch
} from '@/utils/syncFailureToasts'
import { yieldToUi } from '@/utils/time'

function toPageRoute(path: string, params: Record<string, unknown>): PageRoute {
  const pageParams: PageParams = {}
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' || typeof value === 'number') {
      pageParams[key] = value
    }
  }
  return { params: pageParams, path }
}

function AuthenticatedSession() {
  const routeParams = useGlobalSearchParams()
  const [
    justUnlocked,
    skipPin,
    restoredPublicServerName,
    markPageVisited,
    setJustUnlocked,
    setPendingRecoverData,
    setRestoredPublicServerName
  ] = useAuthStore(
    useShallow((state) => [
      state.justUnlocked,
      state.skipPin,
      state.restoredPublicServerName,
      state.markPageVisited,
      state.setJustUnlocked,
      state.setPendingRecoverData,
      state.setRestoredPublicServerName
    ])
  )
  const updateAccount = useAccountsStore((state) => state.updateAccount)
  const { syncAccountWithWallet } = useSyncAccountWithWallet()
  const router = useRouter()
  const { syncAccountWithAddress } = useSyncAccountWithAddress()

  useArkNotifications()
  useArkExitWatcher()
  useArkSwapRunner()
  useEcashPendingMintRunner()
  useFetchBitcoinPrice()

  useEffect(() => {
    initRpcUrlAdjustments()
  }, [])

  const routeName = getFocusedRouteNameFromRoute(useRoute()) || ''

  async function loadWallets() {
    if (!(justUnlocked || skipPin)) {
      return
    }

    await loadAccountWallets()
    setJustUnlocked(false)
  }

  function syncAccountWithLoadedData(
    account: Account,
    reportFailure: SyncErrorReporter
  ) {
    const { wallets: currentWallets, addresses: currentAddresses } =
      useWalletsStore.getState()
    if (account.keys[0].creationType === 'importAddress') {
      if (!currentAddresses[account.id]) {
        return null
      }
      return syncAccountWithAddress(account, reportFailure)
    }
    const wallet = currentWallets[account.id]
    if (!wallet) {
      return null
    }
    return syncAccountWithWallet(account, wallet, false, false, reportFailure)
  }

  async function syncLoadedAccount(
    account: Account,
    reportFailure: SyncErrorReporter
  ) {
    try {
      const updatedAccount = await syncAccountWithLoadedData(
        account,
        reportFailure
      )
      if (updatedAccount) {
        updateAccount(updatedAccount)
      }
    } catch (error) {
      const label = account.name ?? account.id
      const reason = error instanceof Error ? error.message : String(error)
      devLog('session', `sync ${label} failed: ${reason}`, 'error')
      reportFailure(label, error)
    }
  }

  async function syncLoadedWallets(isSessionActive: () => boolean) {
    const { configs, selectedNetwork } = useBlockchainStore.getState()
    if (configs[selectedNetwork].config.connectionMode !== 'auto') {
      return
    }
    await devStep('session', 'sync accounts')
    // Locking cancels queued wallet syncs; this stops new ones being added.
    if (!isSessionActive()) {
      return
    }
    const failures = createSyncFailureBatch()
    // Only accounts on the selected network: the server belongs to it, and
    // other networks' descriptors must not be sent there.
    const accounts = useAccountsStore
      .getState()
      .accounts.filter((account) => account.network === selectedNetwork)
    await Promise.allSettled(
      accounts.map((account) => syncLoadedAccount(account, failures.report))
    )
    failures.flush()
  }

  function handleAcceptRestoredServer() {
    setRestoredPublicServerName(null)
    // The modal only shows while the session is mounted; locking unmounts it
    // and cancels every queued sync.
    void syncLoadedWallets(() => true)
  }

  function handleChangeRestoredServer() {
    setRestoredPublicServerName(null)
    router.navigate('/settings/network/server')
  }

  useEffect(() => {
    // Locking unmounts the session, and nothing may keep decrypting, loading
    // or syncing behind the PIN screen: every step checks it still runs.
    const session = { active: true }
    const isSessionActive = () => session.active

    async function run() {
      await yieldToUi()
      if (!session.active) {
        return
      }

      const { justUnlocked: ju, pendingRecoverData: pending } =
        useAuthStore.getState()

      await devStep('session', 'migrate nostr and service secrets')
      try {
        await migrateAndHydrateNostrSecrets()
        await migrateAndHydrateServiceSecrets()
      } catch {
        // non-critical for boot; secrets may remain unavailable until next unlock
      }
      if (!session.active) {
        return
      }

      if (ju && pending) {
        await devStep('session', 'restore backup')
        const result = await performRecoverOverwrite(pending)
        devLog(
          'session',
          `restore backup ${result.success ? 'done' : 'failed'}`
        )
        setPendingRecoverData(null)
        showRecoverResultToast(result)
      }
      setJustUnlocked(false)
      await devStep('session', 'load wallets')
      await loadWallets()
      devLog('session', 'wallets loaded')
      if (!session.active) {
        return
      }
      // Hold the first sync until the user accepts the public server a
      // restored backup switched to, so nothing is sent to it without their
      // consent. The modal below asks.
      if (useAuthStore.getState().restoredPublicServerName === null) {
        void syncLoadedWallets(isSessionActive)
      }

      try {
        pruneCache()
      } catch {
        // non-critical — cache prune failure should not block startup
      }
      if (session.active) {
        await devStep('session', 'start nostr sync')
        startNostrLifecycle()
      }

      usePayjoinSessionsStore.getState().clearExpiredSessions()
    }
    run()
    return () => {
      session.active = false
      // A sync still running behind the PIN screen drops its result.
      cancelAllAccountSyncs()
      stopNostrLifecycle()
      void teardownUnlockedSessionSafe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (routeName !== '' && routeName !== 'index') {
      markPageVisited(toPageRoute(routeName, routeParams))
    }
  }, [routeName, routeParams, markPageVisited])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={SSNavMenu}
        screenOptions={{
          drawerPosition: 'left',
          drawerStyle: { width: 300 },
          drawerType: 'slide',
          headerShown: false
        }}
      >
        <Drawer.Screen name="(tabs)" />
      </Drawer>
      <SSArkReceiveOverlay />
      <SSPublicServerWarningModal
        visible={restoredPublicServerName !== null}
        serverName={restoredPublicServerName ?? ''}
        reason="restore"
        onConfirm={handleAcceptRestoredServer}
        onCancel={handleChangeRestoredServer}
      />
    </GestureHandlerRootView>
  )
}

export default AuthenticatedSession
