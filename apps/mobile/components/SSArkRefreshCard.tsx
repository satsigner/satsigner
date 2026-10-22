import { StyleSheet } from 'react-native'

import SSLabelTags from '@/components/SSLabelTags'
import SSText from '@/components/SSText'
import SSTimeAgoText from '@/components/SSTimeAgoText'
import { PRIVACY_MASK } from '@/constants/privacy'
import type { DisplayPreferences } from '@/hooks/useDisplayPreferences'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { ArkMovement } from '@/types/models/Ark'
import {
  getArkMovementStatusColor,
  getArkMovementStatusLabel,
  getArkRefreshVtxoLabel,
  isMutedArkMovement
} from '@/utils/arkMovement'
import { formatNumber } from '@/utils/format'

import SSPressable from './SSPressable'

type SSArkRefreshCardProps = Pick<DisplayPreferences, 'privacyMode'> & {
  movement: ArkMovement
  onPress: () => void
  label?: string
}

function SSArkRefreshCard({
  movement,
  onPress,
  label = '',
  privacyMode
}: SSArkRefreshCardProps) {
  const isMuted = isMutedArkMovement(movement)
  const fee = movement.offchainFeeSats
  const timestamp = new Date(movement.createdAt)
  const showStatus = movement.status !== 'successful'
  const feeDisplay = privacyMode ? PRIVACY_MASK : formatNumber(fee)

  return (
    <SSPressable
      onPress={onPress}
      activeOpacity={0.7}
      style={isMuted ? styles.mutedContainer : undefined}
    >
      <SSHStack justifyBetween style={styles.container} gap="sm">
        <SSVStack gap="xxs" style={styles.leftColumn}>
          <SSText size="lg" weight="light" style={styles.vtxoLabel}>
            {getArkRefreshVtxoLabel(movement)}
          </SSText>
          {fee > 0 && (
            <SSText size="xs" style={styles.fee}>
              {t('ark.movement.feeLabel', {
                amount: feeDisplay,
                unit: t('bitcoin.sats')
              })}
            </SSText>
          )}
          <SSLabelTags label={label} privacyMode={privacyMode} size="xs" />
        </SSVStack>
        <SSVStack gap="xxs" style={styles.rightColumn}>
          <SSTimeAgoText date={timestamp} size="xs" />
          {showStatus && (
            <SSText
              size="xxs"
              style={{ color: getArkMovementStatusColor(movement.status) }}
            >
              {getArkMovementStatusLabel(movement.status)}
            </SSText>
          )}
        </SSVStack>
      </SSHStack>
    </SSPressable>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingBottom: 10,
    paddingTop: 10
  },
  fee: {
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
  vtxoLabel: {
    letterSpacing: -0.5
  }
})

export default SSArkRefreshCard
