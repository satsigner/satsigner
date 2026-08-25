import { type Href, useRouter } from 'expo-router'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSArkMovementIcon from '@/components/SSArkMovementIcon'
import SSLabelTags from '@/components/SSLabelTags'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSTimeAgoText from '@/components/SSTimeAgoText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import type { ArkMovement } from '@/types/models/Ark'
import {
  getArkMovementAmountSats,
  getArkMovementCounterparty,
  getArkMovementKind,
  isLightningMovement,
  isMutedArkMovement,
  truncateArkCounterparty
} from '@/utils/arkMovement'
import { formatFiatPrice, formatNumber } from '@/utils/format'

type SSArkMovementCardProps = {
  movement: ArkMovement
  link: Href
  label?: string
}

const ICON_SIZE = 18

function SSArkMovementCard({
  movement,
  link,
  label = ''
}: SSArkMovementCardProps) {
  const router = useRouter()

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

  const kind = getArkMovementKind(movement)
  const amountSats = getArkMovementAmountSats(movement)
  const isLightning = isLightningMovement(movement)
  const isMuted = isMutedArkMovement(movement)
  const fee = movement.offchainFeeSats
  const timestamp = new Date(movement.createdAt)
  const counterparty = getArkMovementCounterparty(movement)

  const satTextType = kind === 'receive' ? 'receive' : 'send'
  const showFee = fee > 0
  const showFiat = btcPrice > 0 && kind !== 'refresh' && amountSats > 0
  const muteAmountColor = kind === 'refresh' || isMuted
  const showRefreshLabel =
    kind === 'refresh' && amountSats === 0 && !privacyMode

  const priceDisplay =
    showFiat && !privacyMode
      ? `${formatFiatPrice(amountSats, btcPrice)} ${fiatCurrency}`
      : showFiat && privacyMode
        ? `•••• ${fiatCurrency}`
        : ''

  return (
    <TouchableOpacity
      onPress={() => router.navigate(link)}
      activeOpacity={0.7}
      style={isMuted ? styles.mutedContainer : undefined}
    >
      <SSHStack justifyBetween style={styles.container} gap="sm">
        <SSVStack gap="xxs" style={styles.leftColumn}>
          <SSHStack gap="sm" style={styles.amountRow}>
            <SSArkMovementIcon
              kind={kind}
              isLightning={isLightning}
              size={ICON_SIZE}
            />
            <SSHStack gap="xs" style={styles.amountCluster}>
              {privacyMode ? (
                <SSText
                  size="xl"
                  weight="light"
                  style={{ letterSpacing: -0.5 }}
                >
                  ••••
                </SSText>
              ) : showRefreshLabel ? (
                <SSText size="xl" weight="light" color="muted">
                  {t('ark.movement.refreshLabel')}
                </SSText>
              ) : (
                <SSStyledSatText
                  amount={amountSats}
                  decimals={0}
                  useZeroPadding={useZeroPadding}
                  currency={currencyUnit}
                  type={satTextType}
                  textSize="xl"
                  noColor={muteAmountColor}
                  weight="light"
                  letterSpacing={-0.5}
                />
              )}
              {!showRefreshLabel && (
                <SSText color="muted" size="sm" style={styles.unit}>
                  {currencyUnit === 'btc'
                    ? t('bitcoin.btc')
                    : t('bitcoin.sats')}
                </SSText>
              )}
            </SSHStack>
          </SSHStack>
          {priceDisplay !== '' && (
            <SSText size="xs" style={styles.fiat}>
              {priceDisplay}
            </SSText>
          )}
          {counterparty && (
            <SSText size="xxs" style={styles.counterparty}>
              {t(
                kind === 'send'
                  ? 'ark.movement.toLabel'
                  : 'ark.movement.fromLabel',
                { value: truncateArkCounterparty(counterparty) }
              )}
            </SSText>
          )}
          <SSLabelTags label={label} size="xs" />
        </SSVStack>
        <SSVStack gap="xxs" style={styles.rightColumn}>
          <SSTimeAgoText date={timestamp} size="xs" />
          {showFee && !privacyMode && (
            <SSText size="xxs" style={styles.fee}>
              {t('ark.movement.feeLabel', {
                amount: formatNumber(fee),
                unit: t('bitcoin.sats')
              })}
            </SSText>
          )}
        </SSVStack>
      </SSHStack>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  amountCluster: {
    alignItems: 'flex-end'
  },
  amountRow: {
    alignItems: 'center'
  },
  container: {
    alignItems: 'flex-start',
    paddingBottom: 10,
    paddingTop: 4
  },
  counterparty: {
    color: Colors.gray[400]
  },
  fee: {
    color: Colors.gray[400],
    textAlign: 'right'
  },
  fiat: {
    color: Colors.gray[400]
  },
  leftColumn: {
    flexShrink: 1
  },
  mutedContainer: {
    opacity: 0.45
  },
  rightColumn: {
    alignItems: 'flex-end'
  },
  unit: {
    marginBottom: -2
  }
})

export default SSArkMovementCard
