import { useGlobalSearchParams } from 'expo-router'
import Drawer from 'expo-router/drawer'
import {
  getFocusedRouteNameFromRoute,
  useRoute
} from 'expo-router/react-navigation'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import { initRpcUrlAdjustments } from '@/api/rpc'
import SSArkReceiveOverlay from '@/components/SSArkReceiveOverlay'
import SSNavMenu from '@/components/SSNavMenu'
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
import type { Account, Key } from '@/types/models/Account'
import { type PageParams, type PageRoute } from '@/types/navigation/page'
import { cancelAllAccountSyncs } from '@/utils/accountSyncRuns'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { decryptAccountKeySecrets } from '@/utils/decryption'
import { devLog, devStep } from '@/utils/devConsole'
import { startNostrLifecycle, stopNostrLifecycle } from '@/utils/nostrLifecycle'
import { migrateAndHydrateNostrSecrets } from '@/utils/nostrSecrets'
import { parseAddressDescriptorToAddress } from '@/utils/parse'
import { performRecoverOverwrite } from '@/utils/recoverBackup'
import { showRecoverResultToast } from '@/utils/recoverToast'
import { migrateAndHydrateServiceSecrets } from '@/utils/serviceSecrets'
import {
  type SyncErrorReporter,
  createSyncFailureBatch
} from '@/utils/syncFailureToasts'

function yieldToUi() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

type AccountWalletLoaders = Pick<
  ReturnType<typeof useWalletsStore.getState>,
  'wallets' | 'addresses' | 'addAccountWallet' | 'addAccountAddress'
>

async function loadAccountWallets({
  wallets,
  addresses,
  addAccountWallet,
  addAccountAddress
}: AccountWalletLoaders) {
  for (const account of useAccountsStore.getState().accounts) {
    try {
      const isImportAddress = account.keys[0].creationType === 'importAddress'
      const existsWallet = !isImportAddress
        ? !!wallets[account.id]
        : !!addresses[account.id]
      if (existsWallet) {
        continue
      }

      const secrets = await decryptAccountKeySecrets(account)
      const tmpAccount: Account = {
        ...account,
        keys: account.keys.map((key, index) => {
          const decryptedKey: Key = { ...key, secret: secrets[index] }
          return decryptedKey
        })
      }

      const walletData = !isImportAddress
        ? await getWalletData(
            tmpAccount,
            appNetworkToBdkNetwork(account.network)
          )
        : undefined
      if (walletData) {
        addAccountWallet(account.id, walletData.wallet, walletData.dbPath)
      }

      const importSecret = tmpAccount.keys[0].secret
      if (isImportAddress && typeof importSecret === 'object') {
        const descriptor = importSecret.externalDescriptor
        if (descriptor) {
          addAccountAddress(
            account.id,
            parseAddressDescriptorToAddress(descriptor)
          )
        }
      }
    } catch (error) {
      const label = account.name ?? account.id
      const reason = error instanceof Error ? error.message : String(error)
      toast.error(`${label}: ${reason}`)
    }
    await yieldToUi()
  }
}

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
    markPageVisited,
    setJustUnlocked,
    setPendingRecoverData
  ] = useAuthStore(
    useShallow((state) => [
      state.justUnlocked,
      state.skipPin,
      state.markPageVisited,
      state.setJustUnlocked,
      state.setPendingRecoverData
    ])
  )
  const updateAccount = useAccountsStore((state) => state.updateAccount)
  const [wallets, addresses, addAccountWallet, addAccountAddress] =
    useWalletsStore(
      useShallow((state) => [
        state.wallets,
        state.addresses,
        state.addAccountWallet,
        state.addAccountAddress
      ])
    )
  const { syncAccountWithWallet } = useSyncAccountWithWallet()
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

    await loadAccountWallets({
      addAccountAddress,
      addAccountWallet,
      addresses,
      wallets
    })
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
      void syncLoadedWallets(isSessionActive)

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
    </GestureHandlerRootView>
  )
}

export default AuthenticatedSession
