import { StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'

type SSExplorerTxSizeBarsProps = {
  sizes: number[]
  totalTxCount: number
}

const BAR_MAX_HEIGHT = 48

function SSExplorerTxSizeBars({
  sizes,
  totalTxCount
}: SSExplorerTxSizeBarsProps) {
  if (sizes.length === 0) {
    return null
  }

  const maxSize = Math.max(...sizes, 1)

  return (
    <SSVStack gap="xs">
      <SSText size="xs" color="muted">
        {t('explorer.block.txSizeSample', {
          count: sizes.length,
          total: totalTxCount
        })}
      </SSText>
      <View style={styles.row}>
        {sizes.map((size, index) => (
          <View
            key={index}
            style={[
              styles.bar,
              {
                height: Math.max(4, (size / maxSize) * BAR_MAX_HEIGHT)
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
    backgroundColor: Colors.gray[400],
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

export default SSExplorerTxSizeBars
