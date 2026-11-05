import { StyleSheet } from 'react-native'

import SSPressable from '@/components/SSPressable'
import SSText from '@/components/SSText'
import { PRIVACY_MASK } from '@/constants/privacy'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Sizes } from '@/styles'
import { formatNumber } from '@/utils/format'

type SSWalletSourceRowProps = {
  id: string
  title: string
  subtitle?: string
  availableSats: number
  privacyMode: boolean
  selected: boolean
  onSelect: (id: string) => void
}

function SSWalletSourceRow({
  id,
  title,
  subtitle,
  availableSats,
  privacyMode,
  selected,
  onSelect
}: SSWalletSourceRowProps) {
  function handlePress() {
    onSelect(id)
  }

  return (
    <SSPressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      activeOpacity={0.6}
      onPress={handlePress}
      style={[styles.row, selected ? styles.selected : styles.unselected]}
    >
      <SSHStack justifyBetween style={styles.content}>
        <SSVStack gap="none" style={styles.titleColumn}>
          <SSText numberOfLines={1} size="sm">
            {title}
          </SSText>
          {subtitle ? (
            <SSText color="muted" numberOfLines={1} size="xs">
              {subtitle}
            </SSText>
          ) : null}
        </SSVStack>
        <SSHStack gap="xxs" style={styles.amount}>
          <SSText size="sm">
            {privacyMode ? PRIVACY_MASK : formatNumber(availableSats)}
          </SSText>
          <SSText color="muted" size="xs">
            {t('bitcoin.sats')}
          </SSText>
        </SSHStack>
      </SSHStack>
    </SSPressable>
  )
}

const styles = StyleSheet.create({
  amount: {
    alignItems: 'baseline'
  },
  content: {
    alignItems: 'center'
  },
  row: {
    borderRadius: Sizes.button.borderRadius,
    borderWidth: Sizes.radioButton.borderWidth,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  selected: {
    backgroundColor: Colors.gray[800],
    borderColor: Colors.gray[300]
  },
  titleColumn: {
    flex: 1
  },
  unselected: {
    backgroundColor: Colors.gray[950],
    borderColor: Colors.gray[700]
  }
})

export default SSWalletSourceRow
