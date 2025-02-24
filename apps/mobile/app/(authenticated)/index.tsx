import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
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
import useVerifyConnection from '@/hooks/useVerifyConnection'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
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

  const [connectionState, connectionString, isPrivateConnection] =
    useVerifyConnection()

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              {t('app.name')}
            </SSText>
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
        <View style={{ flex: 1 }}>
          <SSButton
            label={t('account.add')}
            style={{
              borderTopWidth: 1,
              borderTopColor: '#303030',
              borderBottomWidth: 1,
              borderBottomColor: '#222222',
              borderRadius: 0
            }}
            onPress={() => router.navigate('/addMasterKey/')}
            variant="gradient"
            gradientType="special"
          />
        </View>
      </SSHStack>
      <SSMainLayout style={{ paddingHorizontal: '5%', paddingTop: 32 }}>
        <ScrollView style={{ paddingRight: 16 }}>
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
