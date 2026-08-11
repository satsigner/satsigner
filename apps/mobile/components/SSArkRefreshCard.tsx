import { type Href, useRouter } from 'expo-router'
import { StyleSheet, TouchableOpacity } from 'react-native'

import SSLabelTags from '@/components/SSLabelTags'
import SSText from '@/components/SSText'
import SSTimeAgoText from '@/components/SSTimeAgoText'
import { PRIVACY_MASK } from '@/constants/privacy'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import type { ArkMovement } from '@/types/models/Ark'
import {
  getArkMovementStatusColor,
  getArkMovementStatusLabel,
  getArkRefreshVtxoLabel,
  isMutedArkMovement
} from '@/utils/arkMovement'
import { formatNumber } from '@/utils/format'

type SSArkRefreshCardProps = {
  movement: ArkMovement
  link: Href
  label?: string
}

function SSArkRefreshCard({
  movement,
  link,
  label = ''
}: SSArkRefreshCardProps) {
  const router = useRouter()
  const privacyMode = useSettingsStore((state) => state.privacyMode)

  const isMuted = isMutedArkMovement(movement)
  const fee = movement.offchainFeeSats
  const timestamp = new Date(movement.createdAt)
  const showStatus = movement.status !== 'successful'
  const feeDisplay = privacyMode ? PRIVACY_MASK : formatNumber(fee)

  return (
    <TouchableOpacity
      onPress={() => router.navigate(link)}
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
          <SSLabelTags label={label} size="xs" />
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
    </TouchableOpacity>
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
