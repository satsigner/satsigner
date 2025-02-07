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
import { i18n } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { sampleMainnetWatchOnlyAddrDescriptor, sampleSignetWalletSeed } from '@/utils/samples'
import { getWalletFromDescriptor } from '@/api/bdk'
import { Descriptor } from 'bdk-rn'
import { Network } from 'bdk-rn/lib/lib/enums'
import { Account } from '@/types/models/Account'

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

  const [setName, setSeedWords, loadWallet, lockSeed, getAccount] =
    useAccountBuilderStore(
      useShallow((state) => [
        state.setName,
        state.setSeedWords,
        state.loadWallet,
        state.lockSeed,
        state.getAccount
      ])
    )

  const network = useBlockchainStore(
      useShallow((state) => state.network)
  )

  const [loadingWallet, setLoadingWallet] = useState(false)
  const [loadingWatchOnly, setLoadingWatchOnly] = useState(false)

  async function loadSampleSignetWallet() {
    if (loadingWallet) return
    setLoadingWallet(true)
    setName('My Wallet')
    setSeedWords(sampleSignetWalletSeed)
    const wallet = await loadWallet()
    await lockSeed()
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

  async function loadSampleSignetWatchOnlyWallet() {
    if (loadingWatchOnly) return
    setLoadingWatchOnly(true)
    setName('Watch only El Salvador')

    const addrDescriptor = sampleMainnetWatchOnlyAddrDescriptor

    console.log('getting descriptor')
    const descriptor = await (new Descriptor()).create(
      addrDescriptor,
      network as Network
    )

    console.log('getting wallet')
    const wallet = await getWalletFromDescriptor(
      descriptor,
      null,
      network as Network,
    )

    setLoadingWatchOnly(false)

    const account: Account = {
      name: 'Sample addrr',
      createdAt: new Date(),
      accountCreationType: 'import',
      externalDescriptor: addrDescriptor,
      transactions: [],
      utxos: [],
      summary: {
        balance: 0,
        numberOfAddresses: 0,
        numberOfTransactions: 0,
        numberOfUtxos: 0,
        satsInMempool: 0,
      }
    }

    console.log('adding account')
    await addAccount(account)

    try {
      console.log('syncing account')
      const syncedAccount = await syncWallet(wallet, account)
      console.log('updating account')
      await updateAccount(syncedAccount)
    } catch {
      //
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{i18n.t('satsigner.name')}</SSText>
          )
        }}
      />
      <SSButton
        label={i18n.t('addMasterKey.title')}
        variant="gradient"
        style={{ borderRadius: 0 }}
        onPress={() => router.navigate('/addMasterKey/')}
      />
      <SSMainLayout style={{ paddingHorizontal: '5%', paddingTop: 16 }}>
        <ScrollView>
          {(accounts.length === 0) && (
            <SSVStack itemsCenter>
              <SSText color="muted" uppercase>
                {i18n.t('accountList.noKeysYet')}
              </SSText>
              <SSButton
                label={i18n.t('addMasterKey.loadSampleSignetWallet')}
                variant="ghost"
                style={{ borderRadius: 0 }}
                onPress={loadSampleSignetWallet}
                loading={loadingWallet}
              />
              <SSButton
                label={"Load sample watch only"}
                variant="ghost"
                style={{ borderRadius: 0 }}
                onPress={loadSampleSignetWatchOnlyWallet}
                loading={loadingWatchOnly}
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
