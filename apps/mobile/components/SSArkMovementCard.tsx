import { StyleSheet } from 'react-native'

import SSAmountDisplay from '@/components/SSAmountDisplay'
import SSArkMovementIcon from '@/components/SSArkMovementIcon'
import SSLabelTags from '@/components/SSLabelTags'
import SSText from '@/components/SSText'
import SSTimeAgoText from '@/components/SSTimeAgoText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { ArkMovement } from '@/types/models/Ark'
import type { DisplayPreferences } from '@/types/ui/displayPreferences'
import {
  getArkMovementAmountSats,
  getArkMovementCounterparty,
  getArkMovementKind,
  getArkMovementSatTextType,
  getArkMovementTxids,
  isLightningMovement,
  isMutedArkMovement,
  isOutgoingArkMovementKind,
  truncateArkCounterparty
} from '@/utils/arkMovement'
import { formatFiatPrice, formatNumber, formatTxId } from '@/utils/format'

import SSPressable from './SSPressable'

type SSArkMovementCardProps = Pick<
  DisplayPreferences,
  | 'btcPrice'
  | 'currencyUnit'
  | 'fiatCurrency'
  | 'privacyMode'
  | 'useZeroPadding'
> & {
  movement: ArkMovement
  onPress: () => void
  label?: string
}

const ICON_SIZE = 18
const AMOUNT_CLUSTER_OFFSET_Y = 3

function SSArkMovementCard({
  movement,
  onPress,
  label = '',
  btcPrice,
  currencyUnit,
  fiatCurrency,
  privacyMode,
  useZeroPadding
}: SSArkMovementCardProps) {
  const kind = getArkMovementKind(movement)
  const amountSats = getArkMovementAmountSats(movement)
  const isLightning = isLightningMovement(movement)
  const isMuted = isMutedArkMovement(movement)
  const fee = movement.offchainFeeSats
  const timestamp = new Date(movement.createdAt)
  const counterparty = getArkMovementCounterparty(movement)
  const [txid] = getArkMovementTxids(movement)

  const satTextType = getArkMovementSatTextType(kind)
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
    <SSPressable
      onPress={onPress}
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
              {showRefreshLabel ? (
                <SSText size="xl" weight="light" color="muted">
                  {t('ark.movement.refreshLabel')}
                </SSText>
              ) : (
                <SSAmountDisplay
                  privacyMode={privacyMode}
                  amount={amountSats}
                  decimals={0}
                  useZeroPadding={useZeroPadding}
                  currency={currencyUnit}
                  type={satTextType}
                  textSize="xl"
                  noColor={muteAmountColor}
                  showSign={false}
                  weight="light"
                  letterSpacing={-0.5}
                />
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
                isOutgoingArkMovementKind(kind)
                  ? 'ark.movement.toLabel'
                  : 'ark.movement.fromLabel',
                { value: truncateArkCounterparty(counterparty) }
              )}
            </SSText>
          )}
          {txid ? (
            <SSText size="xxs" style={styles.counterparty}>
              {privacyMode ? '••••' : formatTxId(txid)}
            </SSText>
          ) : null}
          <SSLabelTags label={label} privacyMode={privacyMode} size="xs" />
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
    </SSPressable>
  )
}

const styles = StyleSheet.create({
  amountCluster: {
    alignItems: 'baseline',
    transform: [{ translateY: AMOUNT_CLUSTER_OFFSET_Y }]
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
  }
})

export default SSArkMovementCard
