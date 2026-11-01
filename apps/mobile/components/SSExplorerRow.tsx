import { StyleSheet } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { Colors } from '@/styles'

const EMPTY_VALUE = '--'

type SSExplorerRowProps = {
  label: string
  value: string
  loading: boolean
}

function SSExplorerRow({ label, value, loading }: SSExplorerRowProps) {
  return (
    <SSHStack justifyBetween style={styles.row}>
      <SSText size="sm" style={styles.label}>
        {label}
      </SSText>
      <SSText size="sm" style={styles.value}>
        {loading ? EMPTY_VALUE : value}
      </SSText>
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  label: {
    color: Colors.gray['400']
  },
  row: {
    alignItems: 'center',
    paddingVertical: 4
  },
  value: {
    color: Colors.gray['100']
  }
})

export default SSExplorerRow
