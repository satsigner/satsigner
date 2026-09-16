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
import { useArkNotifications } from '@/hooks/useArkNotifications'
import { useFetchBitcoinPrice } from '@/hooks/useFetchBitcoinPrice'
import useSyncAccountWithAddress from '@/hooks/useSyncAccountWithAddress'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useBlockchainStore } from '@/store/blockchain'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import { useWalletsStore } from '@/store/wallets'
import type { Account, Key } from '@/types/models/Account'
import { type PageParams, type PageRoute } from '@/types/navigation/page'
import { appNetworkToBdkNetwork } from '@/utils/bitcoin'
import { decryptAccountKeySecrets } from '@/utils/decryption'
import { migrateAndHydrateNostrSecrets } from '@/utils/nostrSecrets'
import { parseAddressDescriptorToAddress } from '@/utils/parse'
import { performRecoverOverwrite } from '@/utils/recoverBackup'
import { migrateAndHydrateServiceSecrets } from '@/utils/serviceSecrets'

function yieldToUi() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
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
  const connectionMode = useBlockchainStore(
    (state) => state.configs[state.selectedNetwork].config.connectionMode
  )
  const { syncAccountWithWallet } = useSyncAccountWithWallet()
  const { syncAccountWithAddress } = useSyncAccountWithAddress()

  useArkNotifications()
  useFetchBitcoinPrice()

  useEffect(() => {
    void initRpcUrlAdjustments()
  }, [])

  const routeName = getFocusedRouteNameFromRoute(useRoute()) || ''

  async function loadWallets() {
    if (!(justUnlocked || skipPin)) {
      return
    }

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
    setJustUnlocked(false)
  }

  async function syncLoadedWallets() {
    if (connectionMode !== 'auto') {
      return
    }
    const { wallets: currentWallets, addresses: currentAddresses } =
      useWalletsStore.getState()
    for (const account of useAccountsStore.getState().accounts) {
      try {
        const isImportAddress = account.keys[0].creationType === 'importAddress'
        if (isImportAddress) {
          if (!currentAddresses[account.id]) {
            continue
          }
          const updatedAccount = await syncAccountWithAddress(account)
          if (updatedAccount) {
            updateAccount(updatedAccount)
          }
          continue
        }
        const wallet = currentWallets[account.id]
        if (!wallet) {
          continue
        }
        const updatedAccount = await syncAccountWithWallet(account, wallet)
        if (updatedAccount) {
          updateAccount(updatedAccount)
        }
      } catch (error) {
        const label = account.name ?? account.id
        const reason = error instanceof Error ? error.message : String(error)
        toast.error(`${label}: ${reason}`)
      }
      await yieldToUi()
    }
  }

  useEffect(() => {
    async function run() {
      await yieldToUi()

      const { justUnlocked: ju, pendingRecoverData: pending } =
        useAuthStore.getState()

      try {
        await migrateAndHydrateNostrSecrets()
        await migrateAndHydrateServiceSecrets()
      } catch {
        // non-critical for boot; secrets may remain unavailable until next unlock
      }

      if (ju && pending) {
        const { success } = await performRecoverOverwrite(pending)
        setPendingRecoverData(null)
        if (success) {
          toast.success(t('settings.developer.backupSuccess'))
        } else {
          toast.error(t('settings.developer.recoverOverwriteError'))
        }
      }
      setJustUnlocked(false)
      await loadWallets()
      void syncLoadedWallets()

      try {
        pruneCache()
      } catch {
        // non-critical — cache prune failure should not block startup
      }

      usePayjoinSessionsStore.getState().clearExpiredSessions()
    }
    run()
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
