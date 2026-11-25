import { StyleSheet } from 'react-native'

import SSText from '@/components/SSText'

type SSChatAgentReplyProps = {
  /** model · thinking · cost, already formatted (and masked). */
  label: string | undefined
}

/** Dim line under an agent's reply. Informational only: never a link. */
function SSChatAgentReply({ label }: SSChatAgentReplyProps) {
  if (!label) {
    return null
  }
  return (
    <SSText size="xxs" color="muted" numberOfLines={1} style={styles.line}>
      {label}
    </SSText>
  )
}

const styles = StyleSheet.create({
  line: {
    marginTop: 4
  }
})

export default SSChatAgentReply
