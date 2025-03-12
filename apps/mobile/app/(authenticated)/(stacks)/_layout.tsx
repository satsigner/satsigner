import '@/shim'

import {
  getFocusedRouteNameFromRoute,
  useRoute
} from '@react-navigation/native'
import { type Network } from 'bdk-rn/lib/lib/enums'
import { Redirect, Stack, useGlobalSearchParams, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { getWallet } from '@/api/bdk'
import { SSIconSettings } from '@/components/icons'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import { PIN_KEY } from '@/config/auth'
import useSyncAccountWithAddress from '@/hooks/useSyncAccountWithAddress'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAccountsStore } from '@/store/accounts'
import { useAuthStore } from '@/store/auth'
import { useBlockchainStore } from '@/store/blockchain'
import { useWalletsStore } from '@/store/wallets'
import { Colors } from '@/styles'
import { type Account, type Secret } from '@/types/models/Account'
import { type PageRoute } from '@/types/navigation/page'
import { aesDecrypt } from '@/utils/crypto'
import { parseAddressDescriptorToAddress } from '@/utils/parse'

export default function AuthenticatedLayout() {
  const router = useRouter()
  const routeParams = useGlobalSearchParams()
  const [
    firstTime,
    requiresAuth,
    lockTriggered,
    skipPin,
    justUnlocked,
    setLockTriggered,
    markPageVisited,
    getPagesHistory,
    clearPageHistory,
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
      state.getPagesHistory,
      state.clearPageHistory,
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
  const network = useBlockchainStore((state) => state.network)
  const { syncAccountWithWallet } = useSyncAccountWithWallet()
  const { syncAccountWithAddress } = useSyncAccountWithAddress()

  const routeName = getFocusedRouteNameFromRoute(useRoute()) || ''

  useEffect(() => {
    if (lockTriggered && skipPin) {
      setLockTriggered(false)
      const pages = getPagesHistory()
      clearPageHistory()
      setImmediate(() => {
        for (const page of pages) {
          router.push(page as any)
        }
      })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function loadWallets() {
      if (justUnlocked || skipPin) {
        console.log(Object.keys(wallets).length, '<<<')
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
              const decryptedSecret = JSON.parse(
                decryptedSecretString
              ) as Secret
              key.secret = decryptedSecret
            }

            const walletData = !isImportAddress
              ? await getWallet(temporaryAccount, network as Network)
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
              : await syncAccountWithAddress(
                  account,
                  (temporaryAccount.keys[0].secret as Secret)
                    .externalDescriptor!
                )
            updateAccount(updatedAccount)
          }
        } catch {
          // TODO
        } finally {
          setJustUnlocked(false)
        }
      }
    }

    loadWallets()
  }, [])

  if (firstTime) return <Redirect href="/setPin" />

  if (requiresAuth && lockTriggered && !skipPin)
    return <Redirect href="/unlock" />

  // Do not push index route
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

  return (
    <View style={styles.container}>
      <Stack
        screenOptions={{
          contentStyle: {
            backgroundColor: Colors.gray[950]
          },
          headerBackground: () => (
            <View
              style={{
                height: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: Colors.gray[950]
              }}
            />
          ),
          headerRight: () => (
            <SSIconButton
              style={{ marginRight: 8 }}
              onPress={() => router.navigate('/settings/')}
            >
              <SSIconSettings height={18} width={18} />
            </SSIconButton>
          ),
          headerTitleAlign: 'center',
          headerTintColor: Colors.gray[200],
          headerBackTitleVisible: false
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            headerTitle: () => (
              <SSText uppercase style={{ letterSpacing: 1 }}>
                {t('app.name')}
              </SSText>
            )
          }}
        />
      </Stack>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.gray[900]
  }
})
