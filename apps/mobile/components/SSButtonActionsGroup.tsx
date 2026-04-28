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
import { type ContentContext } from '@/utils/contentDetector'

type SSButtonActionsGroupBase = {
  onSend: () => void
  onCamera: () => void
  onReceive: () => void
  context: ContentContext
}

type SSButtonActionsGroupProps =
  | (SSButtonActionsGroupBase & {
      compact: true
    })
  | (SSButtonActionsGroupBase & {
      compact?: false
      onPaste: () => void
      onNFC: () => void
      nfcAvailable?: boolean
    })

function SSButtonActionsGroup(props: SSButtonActionsGroupProps) {
  if (props.compact) {
    return (
      <SSHStack gap="none">
        <SSActionButton
          onPress={props.onSend}
          style={[styles.actionButton, styles.actionButtonCompactWide]}
        >
          <SSText uppercase>Send</SSText>
        </SSActionButton>
        <SSActionButton
          onPress={props.onCamera}
          style={[styles.actionButton, styles.actionButtonCompactNarrow]}
        >
          <SSIconCamera height={13} width={18} />
        </SSActionButton>
        <SSActionButton
          onPress={props.onReceive}
          style={[styles.actionButton, styles.actionButtonCompactWide]}
        >
          <SSText uppercase>Receive</SSText>
        </SSActionButton>
      </SSHStack>
    )
  }

  const {
    onSend,
    onPaste,
    onCamera,
    onNFC,
    onReceive,
    nfcAvailable = true
  } = props

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
    borderBottomColor: Colors.gray[950],
    borderLeftColor: Colors.gray[950],
    borderRadius: 4,
    borderRightColor: Colors.gray[950],
    borderTopColor: Colors.gray[800],
    borderWidth: 1
  },
  actionButtonCompactNarrow: {
    width: '20%'
  },
  actionButtonCompactWide: {
    width: '40%'
  },
  actionButtonNarrow: {
    width: '16.5%'
  },
  actionButtonWide: {
    width: '25.25%'
  }
})

export default SSButtonActionsGroup
