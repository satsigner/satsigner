import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSAccountCard from '@/components/SSAccountCard'
import SSButton from '@/components/SSButton'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
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

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('app.name')}</SSText>
        }}
      />
      <SSButton
        label={t('account.add')}
        variant="gradient"
        style={{ borderRadius: 0 }}
        onPress={() => router.navigate('/addMasterKey/')}
      />
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
