import { StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { formatNumber } from '@/utils/format'
import { liquidityBarSegmentFlexParts } from '@/utils/lndChannelDetail'

const PRIVACY_MASK = '••••'

type SSLightningChannelLiquidityBarProps = {
  channelCapacity: number
  localSats: number
  nodeTotalCapacity: number
  privacyMode: boolean
  remoteSats: number
}

export default function SSLightningChannelLiquidityBar({
  channelCapacity,
  localSats,
  nodeTotalCapacity,
  privacyMode,
  remoteSats
}: SSLightningChannelLiquidityBarProps) {
  const fmtStat = (n: number) => (privacyMode ? PRIVACY_MASK : formatNumber(n))

  const nodeTotal = Math.max(0, nodeTotalCapacity)
  const loc = nodeTotal > 0 ? Math.max(0, Math.min(localSats, nodeTotal)) : 0
  const rem =
    nodeTotal > 0 ? Math.max(0, Math.min(remoteSats, nodeTotal - loc)) : 0

  const {
    black: barFlexBlack,
    local: barFlexLocal,
    remote: barFlexRemote
  } = liquidityBarSegmentFlexParts(nodeTotal, loc, rem)

  return (
    <SSVStack gap="xs" style={styles.root}>
      <SSHStack gap="md" justifyBetween style={styles.capacityRow}>
        <SSText color="muted" size="xs" weight="medium">
          {t('lightning.node.channelLiquidityTotals')}
        </SSText>
        <SSHStack gap="none" style={styles.capacityValues}>
          <SSText color="white" size="sm" weight="medium">
            {privacyMode ? PRIVACY_MASK : formatNumber(channelCapacity)}
          </SSText>
          <SSText color="muted" size="sm" weight="medium">
            {' / '}
          </SSText>
          <SSText color="muted" size="sm" weight="medium">
            {privacyMode ? PRIVACY_MASK : formatNumber(nodeTotal)}
          </SSText>
        </SSHStack>
      </SSHStack>

      <View style={styles.barTrack}>
        {privacyMode ? (
          <View style={styles.barPrivacyFill} />
        ) : nodeTotal > 0 ? (
          <View style={styles.barSegments}>
            {barFlexLocal > 0 ? (
              <View
                style={[
                  styles.segment,
                  styles.segmentMin,
                  { backgroundColor: Colors.white, flex: barFlexLocal }
                ]}
              />
            ) : null}
            {barFlexRemote > 0 ? (
              <View
                style={[
                  styles.segment,
                  styles.segmentMin,
                  { backgroundColor: Colors.gray[200], flex: barFlexRemote }
                ]}
              />
            ) : null}
            {barFlexBlack > 0 ? (
              <View
                style={[
                  styles.segment,
                  { backgroundColor: Colors.black, flex: barFlexBlack }
                ]}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.barEmpty} />
        )}
      </View>

      <SSHStack gap="md" justifyBetween style={styles.legendRow}>
        <SSHStack gap="xs" style={styles.legendCluster}>
          <SSText size="sm" weight="medium">
            {fmtStat(localSats)}
          </SSText>
          <SSText color="muted" size="xxs" weight="medium">
            {t('lightning.node.channelLiquidityLocal')}
          </SSText>
        </SSHStack>
        <SSHStack gap="xs" style={styles.legendClusterEnd}>
          <SSText color="muted" size="xxs" weight="medium">
            {t('lightning.node.channelLiquidityRemote')}
          </SSText>
          <SSText size="sm" weight="medium">
            {fmtStat(remoteSats)}
          </SSText>
        </SSHStack>
      </SSHStack>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  barEmpty: {
    alignSelf: 'stretch',
    backgroundColor: Colors.gray[800],
    flex: 1,
    minHeight: 12
  },
  barPrivacyFill: {
    alignSelf: 'stretch',
    backgroundColor: Colors.gray[600],
    flex: 1,
    minHeight: 12
  },
  barSegments: {
    alignSelf: 'stretch',
    flex: 1,
    flexDirection: 'row',
    minHeight: 12
  },
  barTrack: {
    alignSelf: 'stretch',
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    height: 12,
    overflow: 'hidden',
    width: '100%'
  },
  capacityRow: {
    alignItems: 'baseline'
  },
  capacityValues: {
    alignItems: 'baseline',
    flexShrink: 0
  },
  legendCluster: {
    alignItems: 'baseline',
    flexShrink: 1,
    minWidth: 0
  },
  legendClusterEnd: {
    alignItems: 'baseline',
    flexShrink: 1,
    minWidth: 0
  },
  legendRow: {
    alignItems: 'baseline'
  },
  root: {
    alignSelf: 'stretch',
    marginTop: 0,
    width: '100%'
  },
  segment: {
    minWidth: 0
  },
  segmentMin: {
    minWidth: 4
  }
})
