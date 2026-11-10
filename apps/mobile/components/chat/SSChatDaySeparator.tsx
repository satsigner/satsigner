import { StyleSheet, View } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { Colors } from '@/styles'

type SSChatDaySeparatorProps = {
  label: string
}

function SSChatDaySeparator({ label }: SSChatDaySeparatorProps) {
  return (
    <SSHStack gap="sm" style={styles.container}>
      <View style={styles.line} />
      <SSText size="xs" color="muted" uppercase>
        {label}
      </SSText>
      <View style={styles.line} />
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginTop: 16
  },
  line: {
    backgroundColor: Colors.gray[800],
    flex: 1,
    height: StyleSheet.hairlineWidth
  }
})

export default SSChatDaySeparator
