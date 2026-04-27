import { FlashList } from '@shopify/flash-list'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Platform, StyleSheet, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconTriangle } from '@/components/icons'
import SSActionButton from '@/components/SSActionButton'
import SSArkMovementCard from '@/components/SSArkMovementCard'
import SSIconButton from '@/components/SSIconButton'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_HIT_BOX,
  HEADER_CHROME_SETTINGS_ICON_SIZE
} from '@/constants/headerChrome'
import { useArkBalance } from '@/hooks/useArkBalance'
import { useArkMovements } from '@/hooks/useArkMovements'
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
import { formatFiatPrice } from '@/utils/format'

const PRIVACY_MASK = '••••'
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
  useFetchBitcoinPrice()

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
  const spendable = balance?.spendableSats ?? 0
  const totalSize = spendable > 1_000_000_000 ? '4xl' : '6xl'
  const isLoading =
    (walletQuery.isLoading || balanceQuery.isLoading) && !balance
  const loadError = walletQuery.error ?? balanceQuery.error

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

  function renderHeaderRight() {
    return (
      <SSIconButton
        style={
          Platform.OS === 'android' && [
            HEADER_CHROME_HIT_BOX,
            { marginRight: -HEADER_CHROME_EDGE_NUDGE }
          ]
        }
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
          data={movementsQuery.data ?? []}
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
                      amount={spendable}
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
                        : formatFiatPrice(spendable, btcPrice)}
                    </SSText>
                    <SSText size="xs" style={{ color: Colors.gray[500] }}>
                      {fiatCurrency}
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
              <SSHStack gap="none" style={styles.actionRow}>
                <SSActionButton
                  style={styles.actionButton}
                  onPress={handleSend}
                >
                  <SSText uppercase>{t('account.send')}</SSText>
                </SSActionButton>
                <SSActionButton
                  style={styles.actionButton}
                  onPress={handleReceive}
                >
                  <SSText uppercase>{t('account.receive')}</SSText>
                </SSActionButton>
              </SSHStack>
            </SSVStack>
          }
          renderItem={({ item }) => (
            <View style={styles.movementItem}>
              <SSArkMovementCard
                movement={item}
                link={`/signer/ark/account/${id}/movement/${item.id}`}
              />
            </View>
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
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderWidth: 1,
    flex: 1,
    height: 56
  },
  actionRow: {
    marginBottom: 16,
    paddingHorizontal: 20,
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
    paddingHorizontal: 20,
    paddingTop: 32
  },
  errorFooter: {
    paddingTop: 12
  },
  headerRight: {
    alignItems: 'center'
  },
  listContainer: {
    flex: 1
  },
  movementItem: {
    paddingHorizontal: 20
  },
  separator: {
    backgroundColor: Colors.gray[800],
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 20
  }
})
