import { StyleSheet } from 'react-native'

import {
  SSIconCamera,
  SSIconPasteClipboard,
  SSIconScanNFC
} from '@/components/icons'
import SSActionButton from '@/components/SSActionButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { Colors } from '@/styles'

type SSButtonActionsGroupProps = {
  onSend: () => void
  onPaste: () => void
  onCamera: () => void
  onNFC: () => void
  onReceive: () => void
  context: 'bitcoin' | 'lightning' | 'ecash'
  nfcAvailable?: boolean
}

function SSButtonActionsGroup({
  onSend,
  onPaste,
  onCamera,
  onNFC,
  onReceive,
  nfcAvailable = true
}: SSButtonActionsGroupProps) {
  return (
    <SSHStack gap="none">
      <SSActionButton
        onPress={onSend}
        style={[styles.actionButton, styles.actionButtonWide]}
      >
        <SSText uppercase>Send</SSText>
      </SSActionButton>
      <SSActionButton
        onPress={onPaste}
        style={[styles.actionButton, styles.actionButtonNarrow]}
      >
        <SSIconPasteClipboard height={16} width={18} />
      </SSActionButton>
      <SSActionButton
        onPress={onCamera}
        style={[styles.actionButton, styles.actionButtonNarrow]}
      >
        <SSIconCamera height={13} width={18} />
      </SSActionButton>
      <SSActionButton
        onPress={onNFC}
        style={[styles.actionButton, styles.actionButtonNarrow]}
        disabled={!nfcAvailable}
      >
        <SSIconScanNFC height={21} width={18} />
      </SSActionButton>
      <SSActionButton
        onPress={onReceive}
        style={[styles.actionButton, styles.actionButtonWide]}
      >
        <SSText uppercase>Receive</SSText>
      </SSActionButton>
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    backgroundColor: Colors.gray[925],
    borderWidth: 1,
    borderTopColor: Colors.gray[800],
    borderLeftColor: Colors.gray[950],
    borderRightColor: Colors.gray[950],
    borderBottomColor: Colors.gray[950],
    borderRadius: 4
  },
  actionButtonWide: {
    width: '25.25%'
  },
  actionButtonNarrow: {
    width: '16.5%'
  }
})

export default SSButtonActionsGroup
