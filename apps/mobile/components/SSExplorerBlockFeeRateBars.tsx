import { StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { ExplorerBlockVizSampleTx } from '@/types/explorer/blockViz'

type SSExplorerBlockFeeRateBarsProps = {
  sampleTxs: ExplorerBlockVizSampleTx[]
  totalTxCount: number
}

const BAR_MAX_HEIGHT = 56

function feeRateColor(feeRate: number): string {
  if (feeRate >= 50) {
    return Colors.white
  }
  if (feeRate >= 10) {
    return Colors.gray[300]
  }
  if (feeRate >= 3) {
    return Colors.mainGreen
  }
  return Colors.gray[600]
}

function SSExplorerBlockFeeRateBars({
  sampleTxs,
  totalTxCount
}: SSExplorerBlockFeeRateBarsProps) {
  if (sampleTxs.length === 0) {
    return null
  }

  const maxFeeRate = Math.max(...sampleTxs.map((tx) => tx.feeRate), 1)

  return (
    <SSVStack gap="xs">
      <SSText size="xs" color="muted">
        {t('explorer.block.viz.feeRateSample', {
          count: sampleTxs.length,
          total: totalTxCount
        })}
      </SSText>
      <View style={styles.row}>
        {sampleTxs.map((tx) => (
          <View
            key={tx.txid}
            style={[
              styles.bar,
              {
                backgroundColor: feeRateColor(tx.feeRate),
                height: Math.max(4, (tx.feeRate / maxFeeRate) * BAR_MAX_HEIGHT)
              }
            ]}
          />
        ))}
      </View>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  bar: {
    borderCurve: 'continuous',
    borderRadius: 1,
    flex: 1,
    maxWidth: 6,
    minWidth: 2
  },
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 1,
    height: BAR_MAX_HEIGHT
  }
})

export default SSExplorerBlockFeeRateBars
