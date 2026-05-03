import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Animated,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native'
import { type SceneRendererProps, TabView } from 'react-native-tab-view'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconBlackIndicator,
  SSIconBubbles,
  SSIconECash,
  SSIconGreenIndicator,
  SSIconList
} from '@/components/icons'
import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSButtonActionsGroup from '@/components/SSButtonActionsGroup'
import SSCameraModal from '@/components/SSCameraModal'
import SSEcashProofCard from '@/components/SSEcashProofCard'
import SSEcashProofsBubbleChart from '@/components/SSEcashProofsBubbleChart'
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
import { useEcashStore } from '@/store/ecash'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors, Sizes } from '@/styles'
import { formatFiatPrice } from '@/utils/format'

const ECASH_BALANCE_LABEL_COLOR = Colors.gray[500]

const MAX_VISIBLE_TRANSACTIONS = 50
const PRIVACY_MASK = '••••'
const TAB_WIDTH = '50%'

const tabs = [{ key: 'transactions' }, { key: 'proofs' }]

export default function EcashAccountDetailPage() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { mints, proofs, transactions, activeAccount, counters } = useEcash()
  const [tabIndex, setTabIndex] = useState(0)
  const [proofsView, setProofsView] = useState<'list' | 'bubbles'>('list')

  const setActiveAccountId = useEcashStore((state) => state.setActiveAccountId)

  if (id && activeAccount?.id !== id) {
    setActiveAccountId(id)
  }

  const [currencyUnit, privacyMode, useZeroPadding] = useSettingsStore(
    useShallow((state) => [
      state.currencyUnit,
      state.privacyMode,
      state.useZeroPadding
    ])
  )
  const [fiatCurrency, btcPrice] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.btcPrice])
  )

  const handleSettingsPress = () =>
    router.navigate(`/signer/ecash/account/${id}/settings`)
  const handleConnectMintPress = () =>
    router.navigate(`/signer/ecash/account/${id}/settings/mint`)

  const ecashContentHandler = useEcashContentHandler()

  const contentHandler = useContentHandler({
    context: 'ecash',
    onContentScanned: ecashContentHandler.handleContentScanned,
    onReceive: ecashContentHandler.handleReceive,
    onSend: ecashContentHandler.handleSend
  })

  const totalBalance = proofs.reduce((sum, proof) => sum + proof.amount, 0)

  const keysetCounters = counters
    ? Object.fromEntries(counters.map((c) => [c.keysetId, c.counter]))
    : undefined

  const allKeysets = mints.flatMap((mint) => mint.keysets)

  function renderTabBar() {
    return (
      <SSHStack
        gap="none"
        style={{
          borderBottomColor: Colors.gray[800],
          borderBottomWidth: 1,
          paddingHorizontal: '5%',
          paddingTop: 8
        }}
      >
        <SSActionButton
          style={{ width: TAB_WIDTH }}
          onPress={() => setTabIndex(0)}
        >
          <View style={styles.tabItem}>
            <SSText center size="lg">
              {privacyMode ? PRIVACY_MASK : transactions.length}
            </SSText>
            <SSText center color="muted" style={{ lineHeight: 12 }}>
              {t('ecash.accountDetail.transactionsTab')}
            </SSText>
            {tabIndex === 0 && <View style={styles.tabIndicator} />}
          </View>
        </SSActionButton>
        <SSActionButton
          style={{ width: TAB_WIDTH }}
          onPress={() => setTabIndex(1)}
        >
          <View style={styles.tabItem}>
            <SSText center size="lg">
              {privacyMode ? PRIVACY_MASK : proofs.length}
            </SSText>
            <SSText center color="muted" style={{ lineHeight: 12 }}>
              {t('ecash.accountDetail.proofsTab')}
            </SSText>
            {tabIndex === 1 && <View style={styles.tabIndicator} />}
          </View>
        </SSActionButton>
      </SSHStack>
    )
  }

  function renderScene({
    route
  }: SceneRendererProps & { route: { key: string } }) {
    switch (route.key) {
      case 'transactions':
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            <SSVStack style={{ paddingBottom: 60 }}>
              {transactions.length > 0 ? (
                <SSVStack gap="sm">
                  {transactions
                    .slice(0, MAX_VISIBLE_TRANSACTIONS)
                    .map((transaction) => (
                      <SSEcashTransactionCard
                        key={transaction.id}
                        transaction={transaction}
                      />
                    ))}
                  {transactions.length > MAX_VISIBLE_TRANSACTIONS && (
                    <SSText
                      color="muted"
                      size="sm"
                      style={styles.moreTransactions}
                    >
                      {t('ecash.moreTransactions', {
                        count: transactions.length - MAX_VISIBLE_TRANSACTIONS
                      })}
                    </SSText>
                  )}
                </SSVStack>
              ) : (
                <SSVStack itemsCenter style={styles.emptyState}>
                  <SSText color="muted">{t('ecash.noTransactions')}</SSText>
                </SSVStack>
              )}
            </SSVStack>
          </ScrollView>
        )
      case 'proofs':
        return (
          <ScrollView showsVerticalScrollIndicator={false}>
            <SSVStack style={{ paddingBottom: 60 }}>
              {proofs.length > 0 ? (
                <SSVStack gap="none">
                  <SSHStack justifyBetween style={styles.proofsSummary}>
                    <SSHStack gap="xs">
                      <SSText color="muted" size="xs">
                        {t('ecash.accountDetail.totalProofs', {
                          count: proofs.length
                        })}
                      </SSText>
                      <SSText color="muted" size="xs">
                        {t('ecash.accountDetail.uniqueKeysets', {
                          count: new Set(proofs.map((p) => p.id)).size
                        })}
                      </SSText>
                    </SSHStack>
                    <SSIconButton
                      onPress={() =>
                        setProofsView(
                          proofsView === 'list' ? 'bubbles' : 'list'
                        )
                      }
                    >
                      {proofsView === 'list' ? (
                        <SSIconBubbles height={16} width={16} />
                      ) : (
                        <SSIconList height={16} width={16} />
                      )}
                    </SSIconButton>
                  </SSHStack>
                  {proofsView === 'bubbles' ? (
                    <SSEcashProofsBubbleChart
                      proofs={proofs}
                      privacyMode={privacyMode}
                      width={width}
                      height={width * 0.8}
                      onProofPress={(proofIndex) =>
                        router.navigate(
                          `/signer/ecash/account/${id}/proof/${proofIndex}`
                        )
                      }
                    />
                  ) : (
                    proofs.map((proof, index) => (
                      <SSEcashProofCard
                        key={`${proof.id}-${proof.secret.slice(0, 8)}`}
                        proof={proof}
                        proofIndex={index}
                        keysets={allKeysets}
                        keysetCounters={keysetCounters}
                        onPress={() =>
                          router.navigate(
                            `/signer/ecash/account/${id}/proof/${index}`
                          )
                        }
                      />
                    ))
                  )}
                </SSVStack>
              ) : (
                <SSVStack itemsCenter style={styles.emptyState}>
                  <SSText color="muted">
                    {t('ecash.accountDetail.noProofs')}
                  </SSText>
                </SSVStack>
              )}
            </SSVStack>
          </ScrollView>
        )
      default:
        return null
    }
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerRight: () => (
            <SSIconButton
              onPress={handleSettingsPress}
              style={{ marginRight: 8 }}
            >
              <SSIconECash
                height={16}
                width={16}
                color={Colors.gray[200]}
                strokeWidth={0.75}
              />
            </SSIconButton>
          ),
          headerTitle: () => (
            <SSText uppercase>
              {activeAccount?.name ?? t('navigation.item.ecash')}
            </SSText>
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
          <SSVStack itemsCenter gap="none">
            <SSVStack style={styles.balanceContainer} gap="xs">
              <SSText color="muted" size="xs" uppercase>
                {t('ecash.mint.balance')}
              </SSText>
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                {privacyMode ? (
                  <SSText
                    color="white"
                    size={totalBalance > 1_000_000_000 ? '4xl' : '6xl'}
                    weight="ultralight"
                    style={{
                      letterSpacing: -1,
                      lineHeight:
                        Sizes.text.fontSize[
                          totalBalance > 1_000_000_000 ? '4xl' : '6xl'
                        ]
                    }}
                  >
                    {PRIVACY_MASK}
                  </SSText>
                ) : (
                  <SSStyledSatText
                    amount={totalBalance}
                    decimals={0}
                    useZeroPadding={useZeroPadding}
                    currency={currencyUnit}
                    textSize={totalBalance > 1_000_000_000 ? '4xl' : '6xl'}
                    weight="ultralight"
                    letterSpacing={-1}
                  />
                )}
                <SSText size="xl" style={{ color: ECASH_BALANCE_LABEL_COLOR }}>
                  {currencyUnit === 'btc'
                    ? t('bitcoin.btc')
                    : t('bitcoin.sats')}
                </SSText>
              </SSHStack>
              {btcPrice > 0 && (
                <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                  <SSText
                    size="xl"
                    style={{ color: ECASH_BALANCE_LABEL_COLOR }}
                  >
                    {privacyMode
                      ? PRIVACY_MASK
                      : formatFiatPrice(totalBalance, btcPrice)}
                  </SSText>
                  <SSText
                    size="xl"
                    style={{ color: ECASH_BALANCE_LABEL_COLOR }}
                  >
                    {fiatCurrency}
                  </SSText>
                </SSHStack>
              )}
              <SSHStack gap="sm" style={styles.statusContainer}>
                {mints.map((mint) => (
                  <SSHStack
                    key={mint.url}
                    gap="xs"
                    style={{ alignItems: 'center' }}
                  >
                    {mint.isConnected ? (
                      <SSIconGreenIndicator height={10} width={10} />
                    ) : (
                      <SSIconBlackIndicator height={10} width={10} />
                    )}
                    <SSText color="muted" size="xs" numberOfLines={1}>
                      {mint.name || mint.url}
                    </SSText>
                  </SSHStack>
                ))}
              </SSHStack>
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
      {mints.length > 0 && (
        <TabView
          style={{ marginTop: -8 }}
          swipeEnabled={false}
          navigationState={{ index: tabIndex, routes: tabs }}
          renderScene={renderScene}
          renderTabBar={renderTabBar}
          onIndexChange={setTabIndex}
          initialLayout={{ width }}
        />
      )}
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
  connectButton: {
    maxWidth: 280,
    width: '100%'
  },
  emptyState: {
    paddingVertical: 40
  },
  moreTransactions: {
    paddingVertical: 8,
    textAlign: 'center'
  },
  noMintContainer: {
    paddingHorizontal: 20,
    paddingVertical: 60
  },
  proofsSummary: {
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 8
  },
  statusContainer: {
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingBottom: 12,
    paddingTop: 4
  },
  tabIndicator: {
    backgroundColor: Colors.white,
    bottom: 0,
    height: 2,
    left: 0,
    position: 'absolute',
    right: 0
  },
  tabItem: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    paddingBottom: 8
  }
})
