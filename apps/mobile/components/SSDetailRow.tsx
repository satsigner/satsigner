import { StyleSheet } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'

type SSDetailRowProps = {
  label: string
  value: string
  valueStyle?: { color: string }
}

function SSDetailRow({ label, value, valueStyle }: SSDetailRowProps) {
  return (
    <SSHStack justifyBetween style={styles.row}>
      <SSText color="muted" size="sm">
        {label}
      </SSText>
      <SSText size="sm" style={[styles.value, valueStyle]}>
        {value}
      </SSText>
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 8
  },
  value: {
    flexShrink: 1,
    textAlign: 'right'
  }
})

export default SSDetailRow
