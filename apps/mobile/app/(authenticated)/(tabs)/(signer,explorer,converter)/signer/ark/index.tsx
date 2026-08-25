import { FlashList } from '@shopify/flash-list'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSAccountCard, {
  type SSAccountCardStat
} from '@/components/SSAccountCard'
import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import { ARK_SERVERS, ARK_SUPPORTED_NETWORKS } from '@/constants/ark'
import { useFetchBitcoinPrice } from '@/hooks/useFetchBitcoinPrice'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { useArkAccountBuilderStore } from '@/store/arkAccountBuilder'
import { Colors } from '@/styles'
import type { ArkAccount, ArkAccountStats } from '@/types/models/Ark'
import { arkNetworkLabel } from '@/utils/ark'

function buildArkAccountCardStats(
  stats: ArkAccountStats | undefined
): SSAccountCardStat[] {
  return [
    {
      label: t('accounts.totalTransactions'),
      value: stats?.numberOfTransactions ?? 0
    },
    {
      label: t('ark.tab.addresses'),
      value: stats?.numberOfAddresses ?? 0
    },
    {
      label: t('ark.tab.vtxos'),
      value: stats?.numberOfVtxos ?? 0
    },
    {
      label: t('ark.tab.refreshes'),
      value: stats?.numberOfRefreshes ?? 0
    }
  ]
}

export default function ArkAccountListPage() {
  const router = useRouter()
  const [accounts, balances, stats] = useArkStore(
    useShallow((state) => [state.accounts, state.balances, state.stats])
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
              <SSAccountCard
                name={item.name}
                balance={balances[item.id]?.spendableSats ?? 0}
                stats={buildArkAccountCardStats(stats[item.id])}
                onPress={() => handleAccountPress(item)}
              />
            )}
            ItemSeparatorComponent={() => (
              <SSSeparator style={{ marginVertical: 16 }} color="gradient" />
            )}
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
  emptyState: {
    paddingHorizontal: 20,
    paddingVertical: 60
  },
  listContainer: {
    flex: 1,
    paddingBottom: 20,
    paddingTop: 16
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
