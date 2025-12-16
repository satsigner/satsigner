import { Stack, useRouter } from 'expo-router'
import { useEffect } from 'react'
import { Animated, ScrollView, StyleSheet } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconBlackIndicator,
  SSIconECash,
  SSIconGreenIndicator
} from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSButtonActionsGroup from '@/components/SSButtonActionsGroup'
import SSCameraModal from '@/components/SSCameraModal'
import SSEcashTransactionCard from '@/components/SSEcashTransactionCard'
import SSIconButton from '@/components/SSIconButton'
import SSNFCModal from '@/components/SSNFCModal'
import SSPaste from '@/components/SSPaste'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import { useContentHandler } from '@/hooks/useContentHandler'
import { useEcash } from '@/hooks/useEcash'
import { useEcashContentHandler } from '@/hooks/useEcashContentHandler'
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
  const [currencyUnit, useZeroPadding] = useSettingsStore(
    useShallow((state) => [state.currencyUnit, state.useZeroPadding])
  )
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

  useEffect(() => {
    fetchPrices(mempoolUrl)
  }, [fetchPrices, fiatCurrency, mempoolUrl])

  const handleSettingsPress = () => router.navigate('/signer/ecash/settings')
  const handleConnectMintPress = () =>
    router.navigate('/signer/ecash/settings/mint')

  const ecashContentHandler = useEcashContentHandler()

  const contentHandler = useContentHandler({
    context: 'ecash',
    onContentScanned: ecashContentHandler.handleContentScanned,
    onSend: ecashContentHandler.handleSend,
    onReceive: ecashContentHandler.handleReceive
  })

  const totalBalance = proofs.reduce((sum, proof) => sum + proof.amount, 0)

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('navigation.item.ecash')}</SSText>
          ),
          headerRight: () => (
            <SSIconButton
              onPress={handleSettingsPress}
              style={{ marginRight: 8 }}
            >
              <SSIconECash height={16} width={16} />
            </SSIconButton>
          )
        }}
      />
      <Animated.View>
        {mints.length === 0 ? (
          <SSVStack itemsCenter gap="lg" style={styles.noMintContainer}>
            <SSVStack itemsCenter gap="sm">
              <SSText size="lg" weight="medium">
                {t('ecash.mint.noMintSelected')}
              </SSText>
              <SSText color="muted" center>
                {t('ecash.mint.noMintSelectedDescription')}
              </SSText>
            </SSVStack>
            <SSButton
              label={t('ecash.mint.connect')}
              onPress={handleConnectMintPress}
              variant="gradient"
              gradientType="special"
              style={styles.connectButton}
            />
          </SSVStack>
        ) : (
          <SSVStack itemsCenter gap="none" style={{ paddingBottom: '4%' }}>
            <SSVStack style={styles.balanceContainer} gap="xs">
              <SSText color="muted" size="xs" uppercase>
                {t('ecash.mint.balance')}
              </SSText>
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSStyledSatText
                  amount={totalBalance}
                  decimals={0}
                  useZeroPadding={useZeroPadding}
                  currency={currencyUnit}
                  textSize={totalBalance > 1_000_000_000 ? '4xl' : '6xl'}
                  weight="ultralight"
                  letterSpacing={-1}
                />
                <SSText size="xl" color="muted">
                  {currencyUnit === 'btc'
                    ? t('bitcoin.btc')
                    : t('bitcoin.sats')}
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
              {activeMint && (
                <SSVStack style={styles.statusContainer} gap="xs">
                  <SSHStack gap="xs" style={{ alignItems: 'center' }}>
                    {activeMint.isConnected ? (
                      <SSIconGreenIndicator height={12} width={12} />
                    ) : (
                      <SSIconBlackIndicator height={12} width={12} />
                    )}
                    <SSText color="muted" size="sm">
                      {activeMint.name || activeMint.url}
                    </SSText>
                  </SSHStack>
                  {!activeMint.isConnected && (
                    <SSText
                      size="xs"
                      style={[styles.errorText, { color: Colors.error }]}
                    >
                      Not connected
                    </SSText>
                  )}
                </SSVStack>
              )}
            </SSVStack>
            <SSButtonActionsGroup
              context="ecash"
              nfcAvailable={contentHandler.nfcAvailable}
              onSend={contentHandler.handleSend}
              onPaste={contentHandler.handlePaste}
              onCamera={contentHandler.handleCamera}
              onNFC={contentHandler.handleNFC}
              onReceive={contentHandler.handleReceive}
            />
          </SSVStack>
        )}
      </Animated.View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack style={{ paddingBottom: 60 }}>
          {transactions.length > 0 && (
            <SSVStack gap="sm">
              {transactions.slice(0, 50).map((transaction) => (
                <SSEcashTransactionCard
                  key={transaction.id}
                  transaction={transaction}
                />
              ))}
              {transactions.length > 50 && (
                <SSText color="muted" size="sm" style={styles.moreTransactions}>
                  {t('ecash.moreTransactions', {
                    count: transactions.length - 50
                  })}
                </SSText>
              )}
            </SSVStack>
          )}
        </SSVStack>
      </ScrollView>
      <SSCameraModal
        visible={contentHandler.cameraModalVisible}
        onClose={contentHandler.closeCameraModal}
        onContentScanned={contentHandler.handleContentScanned}
        context="ecash"
        title={t('ecash.scan.title')}
      />
      <SSNFCModal
        visible={contentHandler.nfcModalVisible}
        onClose={contentHandler.closeNFCModal}
        onContentRead={contentHandler.handleNFCContentRead}
        mode="read"
      />
      <SSPaste
        visible={contentHandler.pasteModalVisible}
        onClose={contentHandler.closePasteModal}
        onContentPasted={contentHandler.handleContentPasted}
        context="ecash"
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  balanceContainer: {
    alignItems: 'center',
    paddingBottom: 12
  },
  statusContainer: {
    paddingBottom: 20,
    alignItems: 'center'
  },
  moreTransactions: {
    textAlign: 'center',
    paddingVertical: 8
  },
  errorText: {
    paddingTop: 4,
    textAlign: 'center'
  },
  noMintContainer: {
    paddingVertical: 60,
    paddingHorizontal: 20
  },
  connectButton: {
    width: '100%',
    maxWidth: 280
  }
})
