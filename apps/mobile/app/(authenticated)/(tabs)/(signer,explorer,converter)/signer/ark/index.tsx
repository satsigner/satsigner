import { FlashList } from '@shopify/flash-list'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import { ARK_SERVERS, ARK_SUPPORTED_NETWORKS } from '@/constants/arkServers'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import { useFetchBitcoinPrice } from '@/hooks/useFetchBitcoinPrice'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { useArkAccountBuilderStore } from '@/store/arkAccountBuilder'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors, Sizes } from '@/styles'
import type { ArkAccount } from '@/types/models/Ark'
import { arkNetworkLabel } from '@/utils/ark'
import { formatFiatPrice } from '@/utils/format'

function ArkAccountCard({
  account,
  balance,
  onPress
}: {
  account: ArkAccount
  balance: number
  onPress: () => void
}) {
  const [currencyUnit, privacyMode, useZeroPadding] = useSettingsStore(
    useShallow((state) => [
      state.currencyUnit,
      state.privacyMode,
      state.useZeroPadding
    ])
  )
  const [btcPrice, fiatCurrency] = usePriceStore(
    useShallow((state) => [state.btcPrice, state.fiatCurrency])
  )

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.accountCardPressed]}
    >
      <View style={styles.accountCard}>
        <View style={styles.accountCardHeader}>
          <SSText weight="medium" size="md">
            {account.name}
          </SSText>
          <SSText color="muted" size="xs" uppercase>
            {arkNetworkLabel(account.network)}
          </SSText>
        </View>
        <View style={styles.accountCardBody}>
          <View style={styles.amountRow}>
            {privacyMode ? (
              <SSText
                size="lg"
                weight="ultralight"
                style={{ lineHeight: Sizes.text.fontSize.lg }}
              >
                {NOSTR_PRIVACY_MASK}
              </SSText>
            ) : (
              <SSStyledSatText
                amount={balance}
                decimals={0}
                useZeroPadding={useZeroPadding}
                currency={currencyUnit}
                textSize="lg"
                weight="ultralight"
                letterSpacing={-1}
              />
            )}
            <SSText
              color="muted"
              size="xs"
              style={{ opacity: privacyMode ? 0 : 1 }}
            >
              {currencyUnit === 'btc' ? 'BTC' : 'sats'}
            </SSText>
          </View>
          {btcPrice > 0 && (
            <SSText
              color="muted"
              size="sm"
              style={{ opacity: privacyMode ? 0 : 1 }}
            >
              {formatFiatPrice(balance, btcPrice)}{' '}
              <SSText size="xs" style={{ color: Colors.gray[500] }}>
                {fiatCurrency}
              </SSText>
            </SSText>
          )}
        </View>
      </View>
    </Pressable>
  )
}

export default function ArkAccountListPage() {
  const router = useRouter()
  const [accounts, balances] = useArkStore(
    useShallow((state) => [state.accounts, state.balances])
  )
  useFetchBitcoinPrice()

  const [tabIndex, setTabIndex] = useState(0)
  const currentNetwork = ARK_SUPPORTED_NETWORKS[tabIndex]
  const filteredAccounts = accounts.filter((a) => a.network === currentNetwork)

  function handleAccountPress(account: ArkAccount) {
    router.navigate({
      params: { id: account.id },
      pathname: '/signer/ark/account/[id]'
    })
  }

  function handleAddAccount() {
    const builder = useArkAccountBuilderStore.getState()
    builder.clearAccount()
    builder.setNetwork(currentNetwork)
    const [defaultServer] = ARK_SERVERS[currentNetwork]
    if (defaultServer) {
      builder.setServerId(defaultServer.id)
    }
    router.navigate('/signer/ark/account/add')
  }

  const renderTabs = () => (
    <SSHStack
      gap="none"
      justifyEvenly
      style={{
        borderBottomColor: Colors.gray[800],
        borderBottomWidth: 1,
        paddingVertical: 0
      }}
    >
      {ARK_SUPPORTED_NETWORKS.map((network, index) => (
        <SSActionButton
          key={network}
          style={{ height: 48, width: '50%' }}
          onPress={() => setTabIndex(index)}
        >
          <SSVStack gap="none">
            <SSText
              center
              uppercase
              style={{ letterSpacing: 3, lineHeight: 20 }}
            >
              {arkNetworkLabel(network)}
            </SSText>
            {tabIndex === index && <View style={styles.tabIndicator} />}
          </SSVStack>
        </SSActionButton>
      ))}
    </SSHStack>
  )

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('navigation.item.ark')}</SSText>
          )
        }}
      />
      {renderTabs()}
      {filteredAccounts.length === 0 ? (
        <SSVStack itemsCenter gap="lg" style={styles.emptyState}>
          <SSVStack itemsCenter gap="sm">
            <SSText uppercase>{t('ark.account.noAccounts')}</SSText>
            <SSText color="muted" center>
              {t('ark.account.noAccountsDescription')}
            </SSText>
          </SSVStack>
          <SSButton
            label={t('ark.account.create')}
            onPress={handleAddAccount}
            variant="outline"
          />
        </SSVStack>
      ) : (
        <SSVStack gap="md" style={styles.listContainer}>
          <FlashList
            data={filteredAccounts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ArkAccountCard
                account={item}
                balance={balances[item.id]?.spendableSats ?? 0}
                onPress={() => handleAccountPress(item)}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
          <SSButton
            label={t('ark.account.create')}
            onPress={handleAddAccount}
            variant="outline"
          />
        </SSVStack>
      )}
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  accountCard: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    padding: 16
  },
  accountCardBody: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4
  },
  accountCardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  accountCardPressed: {
    opacity: 0.7
  },
  addButton: {
    maxWidth: 280,
    width: '100%'
  },
  amountRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 3
  },
  emptyState: {
    paddingHorizontal: 20,
    paddingVertical: 60
  },
  listContainer: {
    flex: 1,
    paddingBottom: 20,
    paddingTop: 16
  },
  separator: {
    height: 8
  },
  tabIndicator: {
    alignSelf: 'center',
    backgroundColor: Colors.white,
    bottom: -15,
    height: 1,
    position: 'absolute',
    width: '100%'
  }
})
