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
import type {
  ArkMovement,
  ArkMovementKind,
  ArkMovementStatus
} from '@/types/models/Ark'
import {
  getArkMovementAmountSats,
  getArkMovementKind,
  isLightningMovement
} from '@/utils/arkMovement'
import { formatFiatPrice, formatNumber } from '@/utils/format'

type SSArkMovementCardProps = {
  movement: ArkMovement
  link: Href
}

const ICON_SIZE = 14

function getStatusColor(status: ArkMovementStatus | string) {
  switch (status) {
    case 'pending':
      return Colors.warning
    case 'successful':
      return Colors.softBarGreen
    case 'failed':
    case 'canceled':
      return Colors.error
    default:
      return Colors.gray[400]
  }
}

function getStatusLabel(status: ArkMovementStatus | string) {
  switch (status) {
    case 'pending':
      return t('ark.movement.status.pending')
    case 'successful':
      return t('ark.movement.status.successful')
    case 'failed':
      return t('ark.movement.status.failed')
    case 'canceled':
      return t('ark.movement.status.canceled')
    default:
      return status.toUpperCase()
  }
}

function getKindLabel(kind: ArkMovementKind) {
  switch (kind) {
    case 'receive':
      return t('ark.movement.kind.receive')
    case 'send':
      return t('ark.movement.kind.send')
    case 'refresh':
      return t('ark.movement.kind.refresh')
    default:
      return ''
  }
}

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
  const fee = movement.offchainFeeSats
  const timestamp = new Date(movement.createdAt)
  const statusLabel = getStatusLabel(movement.status)
  const statusColor = getStatusColor(movement.status)
  const isSettled = movement.status === 'successful'

  const satTextType = kind === 'receive' ? 'receive' : 'send'
  const showFee = fee > 0
  const showFiat = btcPrice > 0 && kind !== 'refresh' && amountSats > 0

  const priceDisplay =
    showFiat && !privacyMode
      ? `${formatFiatPrice(amountSats, btcPrice)} ${fiatCurrency}`
      : showFiat && privacyMode
        ? `•••• ${fiatCurrency}`
        : ''

  return (
    <TouchableOpacity onPress={() => router.navigate(link)} activeOpacity={0.7}>
      <SSVStack style={styles.container} gap="none">
        <SSHStack justifyBetween style={styles.topRow}>
          <SSTimeAgoText date={timestamp} size="xs" />
          {!isSettled && (
            <SSText uppercase size="xs" style={{ color: statusColor }}>
              {statusLabel}
            </SSText>
          )}
        </SSHStack>

        <SSHStack style={styles.amountRow} gap="sm">
          {renderDirectionIcon(kind, isLightning)}
          <SSHStack gap="xs" style={styles.amountCluster}>
            {privacyMode ? (
              <SSText size="xl" weight="light" style={{ letterSpacing: -0.5 }}>
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
                noColor={kind === 'refresh'}
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

        <SSHStack justifyBetween style={styles.bottomRow}>
          <SSText uppercase size="xxs" style={styles.kindTag}>
            {getKindLabel(kind)}
          </SSText>
          {showFee && !privacyMode && (
            <SSText size="xxs" style={{ color: Colors.gray[400] }}>
              {t('ark.movement.feeLabel', {
                amount: formatNumber(fee),
                unit: t('bitcoin.sats')
              })}
            </SSText>
          )}
        </SSHStack>
      </SSVStack>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  amountCluster: {
    alignItems: 'flex-end'
  },
  amountRow: {
    alignItems: 'center',
    marginTop: 6
  },
  bottomRow: {
    alignItems: 'center',
    marginTop: 4
  },
  container: {
    borderColor: Colors.gray[800],
    borderTopWidth: 1,
    paddingBottom: 10,
    paddingTop: 10
  },
  fiat: {
    color: Colors.gray[400],
    marginTop: 2
  },
  kindTag: {
    backgroundColor: Colors.gray[900],
    borderRadius: 4,
    color: Colors.gray[300],
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  topRow: {
    alignItems: 'center'
  },
  unit: {
    marginBottom: -2
  }
})

export default SSArkMovementCard
