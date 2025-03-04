import {
  type DrawerNavigationProp,
  useDrawerStatus
} from '@react-navigation/drawer'
import { Stack, useNavigation, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconBlackIndicator,
  SSIconCloseThin,
  SSIconGreenIndicator,
  SSIconHamburger,
  SSIconYellowIndicator
} from '@/components/icons'
import SSAccountCard from '@/components/SSAccountCard'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
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
import { type Account } from '@/types/models/Account'
import {
  sampleSignetAddress,
  sampleSignetWalletSeed,
  sampleSignetXpub,
  sampleSignetXpubFingerprint
} from '@/utils/samples'

export default function AccountList() {
  const router = useRouter()
  const nav = useNavigation<DrawerNavigationProp<any>>()
  const isDrawerOpen = useDrawerStatus() === 'open'

  const [accounts, addAccount] = useAccountsStore(
    useShallow((state) => [state.accounts, state.addAccount])
  )

  const [
    clearAccount,
    encryptSeed,
    getAccount,
    loadWallet,
    setDescriptorFromAddress,
    setDescriptorFromXpub,
    setFingerprint,
    setName,
    setPassphrase,
    setScriptVersion,
    setSeedWordCount,
    setSeedWords,
    setWatchOnly
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.clearAccount,
      state.encryptSeed,
      state.getAccount,
      state.loadWallet,
      state.setDescriptorFromAddress,
      state.setDescriptorFromXpub,
      state.setFingerprint,
      state.setName,
      state.setPassphrase,
      state.setScriptVersion,
      state.setSeedWordCount,
      state.setSeedWords,
      state.setWatchOnly
    ])
  )

  const [loadingWallet, setLoadingWallet] = useState('')

  async function loadSampleLegacyWallet() {
    setScriptVersion('P2PKH')
    await loadSampleSigningWallet('legacy')
  }

  async function loadSampleSegwitWallet() {
    setScriptVersion('P2WPKH')
    await loadSampleSigningWallet('segwit')
  }

  async function loadSampleWatchOnlyWallet() {
    setScriptVersion('P2PKH')
    setFingerprint(sampleSignetXpubFingerprint)
    await setDescriptorFromXpub(sampleSignetXpub)
    await loadSampleWatchOnly('public-key')
  }

  async function loadSampleWatchOnlyAddressWallet() {
    setDescriptorFromAddress(sampleSignetAddress)
    await loadSampleWatchOnly('address')
  }

  async function loadSampleWatchOnly(
    walletType: NonNullable<Account['watchOnly']>
  ) {
    setLoadingWallet(walletType)
    setName(`My Wallet (watch-only ${walletType})`)
    setWatchOnly(walletType)
    await loadSampleWallet()
  }

  async function loadSampleSigningWallet(walletType: string) {
    setLoadingWallet(walletType)
    setName(`My Wallet (${walletType})`)
    setPassphrase('')
    setSeedWordCount(12)
    setSeedWords(sampleSignetWalletSeed)
    setWatchOnly(undefined)
    await loadWallet()
    await encryptSeed()
    await loadSampleWallet()
  }

  async function loadSampleWallet() {
    if (loadingWallet !== '') return
    const account = getAccount()
    await addAccount(account)
    setLoadingWallet('')
    clearAccount()
    // try {
    //   const syncedAccount = await syncWallet(wallet, account)
    //   await updateAccount(syncedAccount)
    // } catch {
    //   //
    // }
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
          ),
          headerLeft: () => (
            <SSIconButton
              style={{ marginLeft: 8 }}
              onPress={() => nav.openDrawer()}
            >
              {isDrawerOpen ? (
                <SSIconCloseThin height={20} width={20} />
              ) : (
                <SSIconHamburger height={18} width={20} />
              )}
            </SSIconButton>
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
      <SSMainLayout style={{ paddingTop: 32, paddingRight: 2 }}>
        <ScrollView style={{ paddingRight: '6%' }}>
          {accounts.length === 0 && (
            <SSVStack itemsCenter>
              <SSText color="muted" uppercase>
                {t('accounts.empty')}
              </SSText>
              <SSButton
                label={t('account.load.sample.segwit')}
                variant="ghost"
                style={{ borderRadius: 0 }}
                onPress={loadSampleSegwitWallet}
                disabled={loadingWallet !== ''}
                loading={loadingWallet === 'segwit'}
              />
              <SSButton
                label={t('account.load.sample.legacy')}
                variant="ghost"
                style={{ borderRadius: 0 }}
                onPress={loadSampleLegacyWallet}
                disabled={loadingWallet !== ''}
                loading={loadingWallet === 'legacy'}
              />
              <SSButton
                label={t('account.load.sample.xpub')}
                variant="ghost"
                style={{ borderRadius: 0 }}
                onPress={loadSampleWatchOnlyWallet}
                disabled={loadingWallet !== ''}
                loading={loadingWallet === 'xpub'}
              />
              <SSButton
                label={t('account.load.sample.address')}
                variant="ghost"
                style={{ borderRadius: 0 }}
                onPress={loadSampleWatchOnlyAddressWallet}
                disabled={loadingWallet !== ''}
                loading={loadingWallet === 'address'}
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
