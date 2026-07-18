import { StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { formatNumber } from '@/utils/format'

type SSExplorerBlockFeeRangeProps = {
  feeRange: number[]
  medianFee: number | null
}

const RANGE_COLORS = [
  Colors.gray[700],
  Colors.gray[600],
  Colors.gray[500],
  Colors.mainGreen,
  Colors.gray[400],
  Colors.gray[300],
  Colors.white
]

function SSExplorerBlockFeeRange({
  feeRange,
  medianFee
}: SSExplorerBlockFeeRangeProps) {
  if (feeRange.length < 2) {
    return null
  }

  const min = feeRange[0] ?? 0
  const max = feeRange.at(-1) ?? min
  const segments = feeRange.slice(0, -1)

  return (
    <SSVStack gap="xs">
      <SSText size="xs" color="muted">
        {t('explorer.block.viz.feeRange')}
      </SSText>
      <View style={styles.track}>
        {segments.map((start, index) => {
          const end = feeRange[index + 1] ?? start
          const span = Math.max(end - start, 0.01)
          const total = Math.max(max - min, 0.01)
          return (
            <View
              key={`${start}-${end}`}
              style={[
                styles.segment,
                {
                  backgroundColor: RANGE_COLORS[index] ?? Colors.gray[500],
                  flex: span / total
                }
              ]}
            />
          )
        })}
      </View>
      <SSHStack justifyBetween>
        <SSText size="xxs" color="muted">
          {formatNumber(min, 1)} sat/vB
        </SSText>
        {medianFee !== null ? (
          <SSText size="xxs">
            {t('explorer.block.viz.medianFee', {
              rate: formatNumber(medianFee, 1)
            })}
          </SSText>
        ) : null}
        <SSText size="xxs" color="muted">
          {formatNumber(max, 1)} sat/vB
        </SSText>
      </SSHStack>
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  segment: {
    height: '100%',
    minWidth: 2
  },
  track: {
    borderCurve: 'continuous',
    borderRadius: 4,
    flexDirection: 'row',
    height: 16,
    overflow: 'hidden',
    width: '100%'
  }
})

export default SSExplorerBlockFeeRange
