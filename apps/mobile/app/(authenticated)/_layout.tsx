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
import { PIN_KEY } from '@/config/auth'
import useSyncAccountWithAddress from '@/hooks/useSyncAccountWithAddress'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import { getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useBlockchainStore } from '@/store/blockchain'
import { useWalletsStore } from '@/store/wallets'
import { type Account, type Secret } from '@/types/models/Account'
import { type PageRoute } from '@/types/navigation/page'
import { aesDecrypt } from '@/utils/crypto'
import { parseAddressDescriptorToAddress } from '@/utils/parse'

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
    setJustUnlocked
  ] = useAuthStore(
    useShallow((state) => [
      state.firstTime,
      state.requiresAuth,
      state.lockTriggered,
      state.skipPin,
      state.justUnlocked,
      state.setLockTriggered,
      state.markPageVisited,
      state.setJustUnlocked
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
    if (justUnlocked || skipPin) {
      const pin = await getItem(PIN_KEY)
      if (!pin) return
      try {
        for (const account of accounts) {
          const isImportAddress =
            account.keys[0].creationType === 'importAddress'
          const existsWallet = !isImportAddress
            ? !!wallets[account.id]
            : !!addresses[account.id]
          if (existsWallet) continue

          const temporaryAccount = JSON.parse(
            JSON.stringify(account)
          ) as Account

          for (const key of temporaryAccount.keys) {
            const decryptedSecretString = await aesDecrypt(
              key.secret as string,
              pin,
              key.iv
            )
            const decryptedSecret = JSON.parse(decryptedSecretString) as Secret
            key.secret = decryptedSecret
          }

          const walletData = !isImportAddress
            ? await getWalletData(temporaryAccount, account.network as Network)
            : undefined

          if (walletData) addAccountWallet(account.id, walletData.wallet)
          if (
            isImportAddress &&
            typeof temporaryAccount.keys[0].secret === 'object'
          )
            addAccountAddress(
              account.id,
              parseAddressDescriptorToAddress(
                temporaryAccount.keys[0].secret.externalDescriptor!
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
  }

  useEffect(() => {
    if (connectionMode === 'auto') loadWallets()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Do not push index route
  useEffect(() => {
    if (routeName !== '' && routeName !== 'index') {
      const {
        params: _paramsUnused,
        screen: _screenUnused,
        ...filteredRouteParams
      } = routeParams

      markPageVisited({
        path: routeName,
        params: filteredRouteParams
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
          headerShown: false,
          drawerType: 'slide',
          drawerStyle: { width: 300 }
        }}
      >
        <Drawer.Screen name="(tabs)" />
      </Drawer>
    </GestureHandlerRootView>
  )
}
