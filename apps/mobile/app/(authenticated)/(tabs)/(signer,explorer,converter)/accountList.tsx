import {
  type DrawerNavigationProp,
  useDrawerStatus
} from '@react-navigation/drawer'
import { FlashList } from '@shopify/flash-list'
import { Stack, useNavigation, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'
import { toast } from 'sonner-native'
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
import useAccountBuilderFinish from '@/hooks/useAccountBuilderFinish'
import useSyncAccountWithAddress from '@/hooks/useSyncAccountWithAddress'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import useVerifyConnection from '@/hooks/useVerifyConnection'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
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

  const [accounts, updateAccount] = useAccountsStore(
    useShallow((state) => [state.accounts, state.updateAccount])
  )
  const [
    clearAccount,
    getAccountData,
    setFingerprint,
    setName,
    setScriptVersion,
    setExternalDescriptor,
    setExtendedPublicKey,
    setCreationType,
    setMnemonic,
    setMnemonicWordCount,
    setKeyCount,
    setKeysRequired,
    setPolicyType,
    setKey
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.clearAccount,
      state.getAccountData,
      state.setFingerprint,
      state.setName,
      state.setScriptVersion,
      state.setExternalDescriptor,
      state.setExtendedPublicKey,
      state.setCreationType,
      state.setMnemonic,
      state.setMnemonicWordCount,
      state.setKeyCount,
      state.setKeysRequired,
      state.setPolicyType,
      state.setKey
    ])
  )
  const fetchPrices = usePriceStore((state) => state.fetchPrices)
  const { syncAccountWithWallet } = useSyncAccountWithWallet()
  const { syncAccountWithAddress } = useSyncAccountWithAddress()
  const { accountBuilderFinish } = useAccountBuilderFinish()

  fetchPrices()

  type SampleWallet = 'segwit' | 'legacy' | 'watchonlyXpub' | 'watchonlyAddress'
  const [loadingWallet, setLoadingWallet] = useState<SampleWallet>()

  function handleOnNavigateToAddAccount() {
    clearAccount()
    router.navigate('/account/add')
  }

  async function loadSampleWallet(type: SampleWallet) {
    setLoadingWallet(type)
    setName(`My Wallet (${type})`)
    setKeyCount(1)
    setKeysRequired(1)

    switch (type) {
      case 'segwit':
        setScriptVersion('P2WPKH')
        setPolicyType('singlesig')
        setCreationType('importMnemonic')
        setMnemonicWordCount(12)
        setMnemonic(sampleSignetWalletSeed)
        break
      case 'legacy':
        setScriptVersion('P2PKH')
        setPolicyType('singlesig')
        setCreationType('importMnemonic')
        setMnemonicWordCount(12)
        setMnemonic(sampleSignetWalletSeed)
        break
      case 'watchonlyXpub':
        setScriptVersion('P2PKH')
        setPolicyType('watchonly')
        setCreationType('importExtendedPub')
        setExtendedPublicKey(sampleSignetXpub)
        setFingerprint(sampleSignetXpubFingerprint)
        break
      case 'watchonlyAddress':
        setPolicyType('watchonly')
        setCreationType('importAddress')
        setExternalDescriptor(`addr(${sampleSignetAddress})`)
        break
    }

    setKey(0)
    const account = getAccountData()

    const data = await accountBuilderFinish(account)
    if (!data) return

    try {
      const updatedAccount =
        type !== 'watchonlyAddress'
          ? await syncAccountWithWallet(
              data.accountWithEncryptedSecret,
              data.wallet!
            )
          : await syncAccountWithAddress(
              data.accountWithEncryptedSecret,
              `addr(${sampleSignetAddress})`
            )
      updateAccount(updatedAccount)
    } catch (error) {
      toast.error((error as Error).message)
    } finally {
      clearAccount()
      setLoadingWallet(undefined)
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
          ),
          headerLeft: () => (
            <SSIconButton
              style={{ marginLeft: 8 }}
              onPress={() => nav.openDrawer()}
            >
              {isDrawerOpen ? (
                <SSIconCloseThin height={20} width={20} />
              ) : (
                <SSIconHamburger height={18} width={18} />
              )}
            </SSIconButton>
          ),
          headerBackVisible: false
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
            onPress={handleOnNavigateToAddAccount}
            variant="gradient"
            gradientType="special"
          />
        </View>
      </SSHStack>
      <SSMainLayout style={{ paddingTop: 32, paddingRight: 2 }}>
        <ScrollView style={{ paddingRight: '6%' }}>
          <SSVStack>
            <FlashList
              data={accounts}
              renderItem={({ item }) => (
                <SSVStack>
                  <SSAccountCard
                    account={item}
                    onPress={() => router.navigate(`/account/${item.id}`)}
                  />
                </SSVStack>
              )}
              estimatedItemSize={20}
              ItemSeparatorComponent={() => (
                <SSSeparator style={{ marginVertical: 16 }} color="gradient" />
              )}
              ListEmptyComponent={
                <SSVStack
                  itemsCenter
                  style={{ paddingTop: 32, paddingBottom: 32 }}
                >
                  <SSText uppercase>{t('accounts.empty')}</SSText>
                </SSVStack>
              }
              indicatorStyle="white"
              showsVerticalScrollIndicator={false}
            />
          </SSVStack>
          <SSVStack
            itemsCenter
            style={{
              paddingBottom: 100,
              paddingTop: 32
            }}
          >
            <SSText color="muted" uppercase>
              {t('accounts.samples')}
            </SSText>
            <SSButton
              label={t('account.load.sample.segwit')}
              variant="subtle"
              onPress={() => loadSampleWallet('segwit')}
              loading={loadingWallet === 'segwit'}
            />
            <SSButton
              label={t('account.load.sample.legacy')}
              variant="subtle"
              onPress={() => loadSampleWallet('legacy')}
              loading={loadingWallet === 'legacy'}
            />
            <SSButton
              label={t('account.load.sample.xpub')}
              variant="subtle"
              onPress={() => loadSampleWallet('watchonlyXpub')}
              loading={loadingWallet === 'watchonlyXpub'}
            />
            <SSButton
              label={t('account.load.sample.address')}
              variant="subtle"
              onPress={() => loadSampleWallet('watchonlyAddress')}
              loading={loadingWallet === 'watchonlyAddress'}
            />
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}
