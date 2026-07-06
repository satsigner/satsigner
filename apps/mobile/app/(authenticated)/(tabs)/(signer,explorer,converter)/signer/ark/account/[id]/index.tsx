import { FlashList } from '@shopify/flash-list'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconFilter, SSIconTriangle } from '@/components/icons'
import SSIconTime from '@/components/icons/SSIconTime'
import SSArkMovementCard from '@/components/SSArkMovementCard'
import SSButtonActionsGroup from '@/components/SSButtonActionsGroup'
import SSCameraModal from '@/components/SSCameraModal'
import SSCheckbox from '@/components/SSCheckbox'
import SSIconButton from '@/components/SSIconButton'
import SSPopover from '@/components/SSPopover'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_HIT_BOX,
  HEADER_CHROME_SETTINGS_ICON_SIZE
} from '@/constants/headerChrome'
import { PRIVACY_MASK } from '@/constants/privacy'
import { useArkBalance } from '@/hooks/useArkBalance'
import { useArkMovements } from '@/hooks/useArkMovements'
import { useArkSendNavigation } from '@/hooks/useArkSendNavigation'
import { useArkWallet } from '@/hooks/useArkWallet'
import { useFetchBitcoinPrice } from '@/hooks/useFetchBitcoinPrice'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useArkStore } from '@/store/ark'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors, Sizes } from '@/styles'
import { getArkPendingSats, getArkTotalSats } from '@/utils/ark'
import { filterArkMovements } from '@/utils/arkMovement'
import { type DetectedContent } from '@/utils/contentDetector'
import { formatFiatPrice, formatNumber } from '@/utils/format'
const HEADER_ICON_STROKE = '#828282'

export default function ArkAccountDetailPage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()
  const [accounts, cachedBalance] = useArkStore(
    useShallow((state) => [state.accounts, state.balances[id]])
  )
  const account = accounts.find((a) => a.id === id)

  const walletQuery = useArkWallet(id)
  const balanceQuery = useArkBalance(id)
  const movementsQuery = useArkMovements(id)
  const { handleContentReady } = useArkSendNavigation(id)
  useFetchBitcoinPrice()

  const [cameraVisible, setCameraVisible] = useState(false)
  const [showRefresh, setShowRefresh] = useState(false)

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

  const balance = balanceQuery.data ?? cachedBalance
  const total = balance ? getArkTotalSats(balance) : 0
  const pending = balance ? getArkPendingSats(balance) : 0
  const totalSize = total > 1_000_000_000 ? '4xl' : '6xl'
  const isLoading =
    (walletQuery.isLoading || balanceQuery.isLoading) && !balance
  const loadError = walletQuery.error ?? balanceQuery.error

  const movements = filterArkMovements(movementsQuery.data ?? [], showRefresh)

  function handleToggleRefresh() {
    setShowRefresh((prev) => !prev)
  }

  function handleSend() {
    router.navigate({
      params: { id },
      pathname: '/signer/ark/account/[id]/send'
    })
  }

  function handleReceive() {
    router.navigate({
      params: { id },
      pathname: '/signer/ark/account/[id]/receive'
    })
  }

  function handleCamera() {
    setCameraVisible(true)
  }

  async function handleScanned(content: DetectedContent) {
    setCameraVisible(false)
    await handleContentReady(content)
  }

  function renderHeaderRight() {
    return (
      <SSIconButton
        style={[
          HEADER_CHROME_HIT_BOX,
          { marginRight: -HEADER_CHROME_EDGE_NUDGE }
        ]}
        onPress={() =>
          router.navigate({
            params: { id },
            pathname: '/signer/ark/account/[id]/settings'
          })
        }
      >
        <SSIconTriangle
          height={HEADER_CHROME_SETTINGS_ICON_SIZE}
          width={HEADER_CHROME_SETTINGS_ICON_SIZE}
          color={HEADER_ICON_STROKE}
          strokeWidth={0.9}
        />
      </SSIconButton>
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerRight: renderHeaderRight,
          headerTitle: () => (
            <SSText uppercase>
              {account?.name ?? t('navigation.item.ark')}
            </SSText>
          )
        }}
      />
      <View style={styles.listContainer}>
        <FlashList
          data={movements}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          refreshing={movementsQuery.isRefetching}
          onRefresh={() => {
            balanceQuery.refetch()
            movementsQuery.refetch()
          }}
          ListHeaderComponent={
            <SSVStack itemsCenter gap="none">
              <SSVStack style={styles.balanceContainer} gap="xs">
                <SSText color="muted" size="xs" uppercase>
                  {t('ark.balance.title')}
                </SSText>
                <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                  {privacyMode ? (
                    <SSText
                      color="white"
                      size={totalSize}
                      weight="ultralight"
                      style={{
                        letterSpacing: -1,
                        lineHeight: Sizes.text.fontSize[totalSize]
                      }}
                    >
                      {PRIVACY_MASK}
                    </SSText>
                  ) : (
                    <SSStyledSatText
                      amount={total}
                      decimals={0}
                      useZeroPadding={useZeroPadding}
                      currency={currencyUnit}
                      textSize={totalSize}
                      weight="ultralight"
                      letterSpacing={-1}
                    />
                  )}
                  <SSText size="xl" color="muted">
                    {currencyUnit === 'btc'
                      ? t('bitcoin.btc')
                      : t('bitcoin.sats')}
                  </SSText>
                </SSHStack>
                {btcPrice > 0 && (
                  <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                    <SSText color="muted">
                      {privacyMode
                        ? PRIVACY_MASK
                        : formatFiatPrice(total, btcPrice)}
                    </SSText>
                    <SSText size="xs" style={{ color: Colors.gray[500] }}>
                      {fiatCurrency}
                    </SSText>
                  </SSHStack>
                )}
                {pending > 0 && !privacyMode && (
                  <SSHStack gap="xs" style={{ alignItems: 'center' }}>
                    <SSIconTime width={13} height={13} />
                    <SSText color="muted" size="xs">
                      {t('ark.balance.pending', {
                        amount: formatNumber(pending)
                      })}
                    </SSText>
                  </SSHStack>
                )}
                {isLoading && (
                  <SSText color="muted" size="xs">
                    {t('common.loading')}
                  </SSText>
                )}
                {!!loadError && !isLoading && (
                  <SSText style={{ color: Colors.warning }} size="xs" center>
                    {t('ark.error.walletLoad')}
                  </SSText>
                )}
              </SSVStack>
              <View style={styles.actionRow}>
                <SSButtonActionsGroup
                  compact
                  context="ark"
                  onSend={handleSend}
                  onCamera={handleCamera}
                  onReceive={handleReceive}
                />
              </View>
              <SSHStack justifyBetween style={styles.toolbar}>
                <SSText color="muted" uppercase size="xs">
                  {t('ark.movement.activity')}
                </SSText>
                <SSPopover
                  accessibilityLabel={t('ark.movement.filter')}
                  trigger={<SSIconFilter height={16} width={18} />}
                >
                  <SSCheckbox
                    label={t('ark.movement.showRefreshes')}
                    labelProps={{ color: 'white', size: 'md' }}
                    selected={showRefresh}
                    onPress={handleToggleRefresh}
                  />
                </SSPopover>
              </SSHStack>
            </SSVStack>
          }
          renderItem={({ item }) => (
            <SSArkMovementCard
              movement={item}
              link={`/signer/ark/account/${id}/movement/${item.id}`}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            movementsQuery.isLoading ? null : (
              <SSVStack style={styles.emptyContainer}>
                <SSText color="muted">{t('ark.movement.empty')}</SSText>
              </SSVStack>
            )
          }
          ListFooterComponent={
            movementsQuery.error ? (
              <SSText
                style={[styles.errorFooter, { color: Colors.warning }]}
                size="xs"
                center
              >
                {t('ark.movement.error.load')}
              </SSText>
            ) : null
          }
        />
      </View>
      <SSCameraModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onContentScanned={handleScanned}
        context="ark"
        title={t('ark.send.scanTitle')}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  actionRow: {
    marginBottom: 16,
    paddingVertical: 12,
    width: '100%'
  },
  balanceContainer: {
    alignItems: 'center',
    paddingBottom: 12,
    paddingTop: 24
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 32
  },
  errorFooter: {
    paddingTop: 12
  },
  listContainer: {
    flex: 1
  },
  separator: {
    backgroundColor: Colors.gray[800],
    height: StyleSheet.hairlineWidth
  },
  toolbar: {
    paddingBottom: 8,
    width: '100%'
  }
})
