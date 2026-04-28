import { type Href, useRouter } from 'expo-router'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import {
  SSIconIncoming,
  SSIconIncomingLightning,
  SSIconOutgoing,
  SSIconOutgoingLightning,
  SSIconRefresh
} from '@/components/icons'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSTimeAgoText from '@/components/SSTimeAgoText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import type { ArkMovement, ArkMovementKind } from '@/types/models/Ark'
import {
  getArkMovementAmountSats,
  getArkMovementCounterparty,
  getArkMovementKind,
  isLightningMovement,
  isStaleArkExitMovement,
  truncateArkCounterparty
} from '@/utils/arkMovement'
import { formatFiatPrice, formatNumber } from '@/utils/format'

type SSArkMovementCardProps = {
  movement: ArkMovement
  link: Href
}

const ICON_SIZE = 14

function renderDirectionIcon(kind: ArkMovementKind, isLightning: boolean) {
  if (kind === 'refresh') {
    return <SSIconRefresh height={ICON_SIZE} width={ICON_SIZE} />
  }
  if (kind === 'receive') {
    return isLightning ? (
      <SSIconIncomingLightning height={ICON_SIZE} width={ICON_SIZE} />
    ) : (
      <SSIconIncoming height={ICON_SIZE} width={ICON_SIZE} />
    )
  }
  return isLightning ? (
    <SSIconOutgoingLightning height={ICON_SIZE} width={ICON_SIZE} />
  ) : (
    <SSIconOutgoing height={ICON_SIZE} width={ICON_SIZE} />
  )
}

function SSArkMovementCard({ movement, link }: SSArkMovementCardProps) {
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
  const isStale = isStaleArkExitMovement(movement)
  const fee = movement.offchainFeeSats
  const timestamp = new Date(movement.createdAt)
  const counterparty = getArkMovementCounterparty(movement)

  const satTextType = kind === 'receive' ? 'receive' : 'send'
  const showFee = fee > 0
  const showFiat = btcPrice > 0 && kind !== 'refresh' && amountSats > 0
  const muteAmountColor = kind === 'refresh' || isStale

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
      style={isStale ? styles.staleContainer : undefined}
    >
      <SSHStack justifyBetween style={styles.container} gap="sm">
        <SSVStack gap="xxs" style={styles.leftColumn}>
          <SSHStack gap="sm" style={styles.amountRow}>
            {renderDirectionIcon(kind, isLightning)}
            <SSHStack gap="xs" style={styles.amountCluster}>
              {privacyMode ? (
                <SSText
                  size="xl"
                  weight="light"
                  style={{ letterSpacing: -0.5 }}
                >
                  ••••
                </SSText>
              ) : kind === 'refresh' && amountSats === 0 ? (
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
              <SSText color="muted" size="sm" style={styles.unit}>
                {currencyUnit === 'btc' ? t('bitcoin.btc') : t('bitcoin.sats')}
              </SSText>
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
    paddingTop: 10
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
  rightColumn: {
    alignItems: 'flex-end'
  },
  staleContainer: {
    opacity: 0.45
  },
  unit: {
    marginBottom: -2
  }
})

export default SSArkMovementCard
