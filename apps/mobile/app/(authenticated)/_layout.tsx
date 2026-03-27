import {
  getFocusedRouteNameFromRoute,
  useRoute
} from '@react-navigation/native'
import { type Network } from 'bdk-rn/lib/lib/enums'
import { Redirect, useGlobalSearchParams } from 'expo-router'
import Drawer from 'expo-router/drawer'
import { useEffect } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { getWalletData } from '@/api/bdk'
import SSNavMenu from '@/components/SSNavMenu'
import useSyncAccountWithAddress from '@/hooks/useSyncAccountWithAddress'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useBlockchainStore } from '@/store/blockchain'
import { useWalletsStore } from '@/store/wallets'
import type { Account, Key } from '@/types/models/Account'
import { type PageRoute } from '@/types/navigation/page'
import { decryptAllAccountKeySecrets } from '@/utils/account'
import { parseAddressDescriptorToAddress } from '@/utils/parse'
import { performRecoverOverwrite } from '@/utils/recoverBackup'

export default function AuthenticatedLayout() {
  const routeParams = useGlobalSearchParams()
  const [
    firstTime,
    requiresAuth,
    lockTriggered,
    skipPin,
    justUnlocked,
    setLockTriggered,
    markPageVisited,
    setJustUnlocked,
    setPendingRecoverData
  ] = useAuthStore(
    useShallow((state) => [
      state.firstTime,
      state.requiresAuth,
      state.lockTriggered,
      state.skipPin,
      state.justUnlocked,
      state.setLockTriggered,
      state.markPageVisited,
      state.setJustUnlocked,
      state.setPendingRecoverData
    ])
  )
  const [accounts, updateAccount] = useAccountsStore(
    useShallow((state) => [state.accounts, state.updateAccount])
  )
  const [wallets, addresses, addAccountWallet, addAccountAddress] =
    useWalletsStore(
      useShallow((state) => [
        state.wallets,
        state.addresses,
        state.addAccountWallet,
        state.addAccountAddress
      ])
    )
  const [connectionMode] = useBlockchainStore((state) => [
    state.configs[state.selectedNetwork].config.connectionMode
  ])
  const { syncAccountWithWallet } = useSyncAccountWithWallet()
  const { syncAccountWithAddress } = useSyncAccountWithAddress()

  const routeName = getFocusedRouteNameFromRoute(useRoute()) || ''

  // Nostr subscriptions are now managed by:
  // 1. NostrSyncService singleton with automatic retry and lifecycle management
  // 2. Screen-level useFocusEffect hooks (e.g., devicesGroupChat)
  // This removes the global polling and app state management from the layout

  useEffect(() => {
    if (lockTriggered && skipPin) {
      setLockTriggered(false)
      // const pages = getPagesHistory()
      // clearPageHistory()
      // setImmediate(() => {
      //   for (const page of pages) {
      //     router.push(page as any)
      //   }
      // })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadWallets() {
    if (!(justUnlocked || skipPin)) return

    try {
      for (const account of accounts) {
        const isImportAddress = account.keys[0].creationType === 'importAddress'
        const existsWallet = !isImportAddress
          ? !!wallets[account.id]
          : !!addresses[account.id]
        if (existsWallet) continue

        const secrets = await decryptAllAccountKeySecrets(account)
        const tmpAccount: Account = {
          ...account,
          keys: account.keys.map((key, index) => {
            const decryptedKey: Key = { ...key, secret: secrets[index] }
            return decryptedKey
          })
        }

        const walletData = !isImportAddress
          ? await getWalletData(tmpAccount, account.network as Network)
          : undefined
        if (walletData) addAccountWallet(account.id, walletData.wallet)

        if (isImportAddress && typeof tmpAccount.keys[0].secret === 'object')
          addAccountAddress(
            account.id,
            parseAddressDescriptorToAddress(
              tmpAccount.keys[0].secret.externalDescriptor!
            )
          )

        const updatedAccount = !isImportAddress
          ? await syncAccountWithWallet(account, walletData!.wallet)
          : await syncAccountWithAddress(account)
        updateAccount(updatedAccount)
      }
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      setJustUnlocked(false)
    }
  }

  useEffect(() => {
    async function run() {
      const { justUnlocked: ju, pendingRecoverData: pending } =
        useAuthStore.getState()
      if (ju && pending) {
        const { success } = await performRecoverOverwrite(pending)
        setPendingRecoverData(null)
        if (success) toast.success(t('settings.developer.backupSuccess'))
        else toast.error(t('settings.developer.recoverOverwriteError'))
      }
      if (connectionMode === 'auto') await loadWallets()
    }
    run()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Do not push index route
  useEffect(() => {
    if (routeName !== '' && routeName !== 'index') {
      const { ...filteredRouteParams } = routeParams

      markPageVisited({
        params: filteredRouteParams,
        path: routeName
      } as PageRoute)
    }
  }, [routeName, routeParams, markPageVisited])

  if (firstTime) return <Redirect href="/setPin" />

  if (requiresAuth && lockTriggered && !skipPin)
    return <Redirect href="/unlock" />

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <SSNavMenu {...props} />}
        screenOptions={{
          drawerPosition: 'left',
          drawerStyle: { width: 300 },
          drawerType: 'slide',
          headerShown: false
        }}
      >
        <Drawer.Screen name="(tabs)" />
      </Drawer>
    </GestureHandlerRootView>
  )
}
