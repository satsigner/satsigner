import { Stack, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSEcashTransactionCard from '@/components/SSEcashTransactionCard'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { formatFiatPrice } from '@/utils/format'

export default function EcashLanding() {
  const router = useRouter()
  const { mints, activeMint, proofs, transactions } = useEcash()
  const useZeroPadding = useSettingsStore((state) => state.useZeroPadding)
  const [fiatCurrency, btcPrice, fetchPrices] = usePriceStore(
    useShallow((state) => [
      state.fiatCurrency,
      state.btcPrice,
      state.fetchPrices
    ])
  )
  const mempoolUrl = useBlockchainStore(
    (state) => state.configsMempool['bitcoin']
  )

  // Fetch prices on mount and when currency changes
  useEffect(() => {
    fetchPrices(mempoolUrl)
  }, [fetchPrices, fiatCurrency, mempoolUrl])

  const handleSendPress = () => {
    router.navigate('/signer/ecash/send')
  }

  const handleReceivePress = () => {
    router.navigate('/signer/ecash/receive')
  }

  const handleMintPress = () => {
    router.navigate('/signer/ecash/mint')
  }

  const handleBackupPress = () => {
    router.navigate('/signer/ecash/backup')
  }

  const handleRecoveryPress = () => {
    router.navigate('/signer/ecash/recovery')
  }

  // Calculate total balance from all proofs
  const totalBalance = proofs.reduce((sum, proof) => sum + proof.amount, 0)

  return (
    <SSMainLayout style={{ paddingTop: 0 }}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('navigation.item.ecash')}</SSText>
          )
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack style={{ paddingBottom: 60 }}>
          <SSVStack style={styles.balanceContainer} gap="xs">
            <SSText color="muted" size="xs" uppercase>
              {t('ecash.mint.balance')}
            </SSText>
            <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
              <SSStyledSatText
                amount={totalBalance}
                decimals={0}
                useZeroPadding={useZeroPadding}
                textSize={totalBalance > 1_000_000_000 ? '4xl' : '6xl'}
                weight="ultralight"
                letterSpacing={-1}
              />
              <SSText size="xl" color="muted">
                {t('bitcoin.sats').toLowerCase()}
              </SSText>
            </SSHStack>
            {btcPrice > 0 && (
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText color="muted">
                  {formatFiatPrice(totalBalance, btcPrice)}
                </SSText>
                <SSText size="xs" style={{ color: Colors.gray[500] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            )}
            {mints.length > 0 && (
              <SSVStack style={styles.statusContainer} gap="none">
                {activeMint && (
                  <SSText color="muted" size="sm">
                    {activeMint.name || activeMint.url}
                  </SSText>
                )}
              </SSVStack>
            )}
          </SSVStack>

          <SSHStack gap="sm">
            <SSButton
              style={{ flex: 1 }}
              label={t('ecash.send.title')}
              onPress={handleSendPress}
              variant="gradient"
              gradientType="special"
            />
            <SSButton
              label={t('ecash.receive.title')}
              style={{ flex: 1 }}
              onPress={handleReceivePress}
              variant="gradient"
              gradientType="special"
            />
          </SSHStack>
          <SSVStack gap="sm">
            <SSButton
              label={t('ecash.mint.title')}
              onPress={handleMintPress}
              variant="subtle"
            />
            <SSHStack gap="sm">
              <SSButton
                label={t('ecash.backup.title')}
                onPress={handleBackupPress}
                variant="subtle"
                style={{ flex: 1 }}
              />
              <SSButton
                label={t('ecash.recovery.title')}
                onPress={handleRecoveryPress}
                variant="subtle"
                style={{ flex: 1 }}
              />
            </SSHStack>
          </SSVStack>
          {transactions.length > 0 && (
            <SSVStack gap="sm">
              <SSText uppercase>{t('ecash.transactionHistory.title')}</SSText>
              {transactions.slice(0, 50).map((transaction) => (
                <SSEcashTransactionCard
                  key={transaction.id}
                  transaction={transaction}
                />
              ))}
              {transactions.length > 50 && (
                <SSText color="muted" size="sm" style={styles.moreTransactions}>
                  +{transactions.length - 50} more transactions
                </SSText>
              )}
            </SSVStack>
          )}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  balanceContainer: {
    alignItems: 'center',
    paddingTop: 40
  },
  headerContainer: {},
  headerText: {
    color: Colors.white
  },
  statusContainer: {
    paddingBottom: 20,
    alignItems: 'center'
  },
  moreTransactions: {
    textAlign: 'center',
    paddingVertical: 8
  }
})
