import NetInfo from '@react-native-community/netinfo'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconBlackIndicator,
  SSIconGreenIndicator,
  SSIconYellowIndicator
} from '@/components/icons'
import SSAccountCard from '@/components/SSAccountCard'
import SSButton from '@/components/SSButton'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { sampleSignetWalletSeed } from '@/utils/samples'

export default function AccountList() {
  const router = useRouter()
  const [accounts, addAccount, updateAccount, syncWallet] = useAccountsStore(
    useShallow((state) => [
      state.accounts,
      state.addAccount,
      state.updateAccount,
      state.syncWallet
    ])
  )

  const [setName, setSeedWords, loadWallet, encryptSeed, getAccount] =
    useAccountBuilderStore(
      useShallow((state) => [
        state.setName,
        state.setSeedWords,
        state.loadWallet,
        state.encryptSeed,
        state.getAccount
      ])
    )

  const [network, url, timeout] = useBlockchainStore(
    useShallow((state) => [state.network, state.url, state.timeout * 1000])
  )

  const [loadingWallet, setLoadingWallet] = useState(false)

  async function loadSampleSignetWallet() {
    if (loadingWallet) return
    setLoadingWallet(true)
    setName('My Wallet')
    setSeedWords(sampleSignetWalletSeed)
    const wallet = await loadWallet()
    await encryptSeed()
    const account = getAccount()
    await addAccount(account)
    setLoadingWallet(false)

    try {
      const syncedAccount = await syncWallet(wallet, account)
      await updateAccount(syncedAccount)
    } catch {
      //
    }
  }

  const isConnectionAvailable = useRef<boolean | null>(false)
  const [connectionState, setConnectionState] = useState<boolean>(false)
  const connectionString = useMemo(() => {
    return network + ' - ' + url
  }, [network, url])

  const verifyUrl = useMemo(() => {
    const urlObj = new URL(url)
    if (urlObj.protocol === 'ssl:') {
      const modifiedUrl = new URL(url.replace('ssl://', 'https://'))
      modifiedUrl.port = ''
      modifiedUrl.pathname = '/signet/api/v1/difficulty-adjustment'
      return modifiedUrl.toString()
    } else {
      urlObj.pathname = '/api/v1/difficulty-adjustment'
    }
    return urlObj.toString()
  }, [url])

  const isPrivateConnection = useMemo(() => {
    if (
      url === 'ssl://mempool.space:60602' ||
      url === 'https://mutinynet.com/api'
    ) {
      return false
    }
    return true
  }, [url])

  const verifyConnection = useCallback(async () => {
    if (!isConnectionAvailable.current) {
      setConnectionState(false)
      return
    }
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeout)
      )
      const fetchPromise = fetch(verifyUrl)
      const response = (await Promise.race([
        timeoutPromise,
        fetchPromise
      ])) as Response
      if (!isConnectionAvailable.current) {
        setConnectionState(false)
        return
      }
      if (response.ok) {
        setConnectionState(true)
      } else {
        setConnectionState(false)
      }
    } catch (_) {
      setConnectionState(false)
    }
  }, [timeout, verifyUrl])

  const checkConnection = useCallback(async () => {
    const state = await NetInfo.fetch()
    isConnectionAvailable.current = state.isConnected
  }, [])

  useEffect(() => {
    ;(async () => {
      await checkConnection()
      verifyConnection()
    })()
    const timerId = setInterval(() => {
      verifyConnection()
    }, 60000)

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (
        isConnectionAvailable.current !== state.isConnected &&
        state.isConnected !== null
      ) {
        isConnectionAvailable.current = state.isConnected
        if (state.isConnected) {
          setTimeout(verifyConnection, 5000)
        } else {
          verifyConnection()
        }
      } else {
        isConnectionAvailable.current = state.isConnected
      }
    })

    return () => {
      unsubscribe()
      clearInterval(timerId)
    }
  }, [checkConnection, verifyConnection])

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSHStack style={{ gap: 8 }}>
              <SSText uppercase>{t('app.name').split(' ').at(0)}</SSText>
              <SSText uppercase>{t('app.name').split(' ').at(1)}</SSText>
            </SSHStack>
          )
        }}
      />
      <SSHStack style={{ justifyContent: 'center', gap: 0, marginBottom: 24 }}>
        {connectionState ? (
          isPrivateConnection ? (
            <SSIconYellowIndicator height={24} width={24} />
          ) : (
            <SSIconGreenIndicator height={24} width={24} />
          )
        ) : (
          <SSIconBlackIndicator height={24} width={24} />
        )}
        <SSText
          size="xxs"
          uppercase
          style={{
            color: connectionState ? Colors.gray['200'] : Colors.gray['450']
          }}
        >
          {connectionString}
        </SSText>
      </SSHStack>
      <SSHStack style={{ paddingHorizontal: '5%' }}>
        <SSButton
          label={t('account.add')}
          style={{ borderRadius: 0, backgroundColor: Colors.gray[870] }}
          onPress={() => router.navigate('/addMasterKey/')}
        />
      </SSHStack>
      <SSMainLayout style={{ paddingHorizontal: '5%', paddingTop: 16 }}>
        <ScrollView>
          {accounts.length === 0 && (
            <SSVStack itemsCenter>
              <SSText color="muted" uppercase>
                {t('accounts.empty')}
              </SSText>
              <SSButton
                label={t('account.load.sample.signet')}
                variant="ghost"
                style={{ borderRadius: 0 }}
                onPress={loadSampleSignetWallet}
                loading={loadingWallet}
              />
            </SSVStack>
          )}
          <SSVStack>
            {accounts.map((account) => (
              <SSVStack key={account.name}>
                <SSAccountCard
                  account={account}
                  onPress={() => router.navigate(`/account/${account.name}`)}
                />
                <SSSeparator color="gradient" />
              </SSVStack>
            ))}
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}
