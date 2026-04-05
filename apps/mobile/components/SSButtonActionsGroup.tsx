import { StyleSheet } from 'react-native'

import {
  SSIconCamera,
  SSIconPasteClipboard,
  SSIconScanNFC
} from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSHStack from '@/layouts/SSHStack'
import { Sizes } from '@/styles'

type SSButtonActionsGroupProps = {
  onSend: () => void
  onPaste: () => void
  onCamera: () => void
  onNFC: () => void
  onReceive: () => void
  context: 'bitcoin' | 'lightning' | 'ecash'
  nfcAvailable?: boolean
}

const TOTAL_BUTTONS = 5

function SSButtonActionsGroup({
  onSend,
  onPaste,
  onCamera,
  onNFC,
  onReceive,
  nfcAvailable = true
}: SSButtonActionsGroupProps) {
  return (
    <SSHStack gap="xxs">
      <SSButton
        variant="elevated"
        horizontalIndex={0}
        totalButtons={TOTAL_BUTTONS}
        label="Send"
        onPress={onSend}
        style={[styles.actionButtonWide, styles.actionButtonHeight]}
      />
      <SSButton
        variant="elevated"
        horizontalIndex={1}
        totalButtons={TOTAL_BUTTONS}
        icon={<SSIconPasteClipboard height={16} width={18} />}
        onPress={onPaste}
        style={[styles.actionButtonNarrow, styles.actionButtonHeight]}
      />
      <SSButton
        variant="elevated"
        horizontalIndex={2}
        totalButtons={TOTAL_BUTTONS}
        icon={<SSIconCamera height={13} width={18} />}
        onPress={onCamera}
        style={[styles.actionButtonNarrow, styles.actionButtonHeight]}
      />
      <SSButton
        variant="elevated"
        horizontalIndex={3}
        totalButtons={TOTAL_BUTTONS}
        icon={<SSIconScanNFC height={21} width={18} />}
        onPress={onNFC}
        disabled={!nfcAvailable}
        style={[styles.actionButtonNarrow, styles.actionButtonHeight]}
      />
      <SSButton
        variant="elevated"
        horizontalIndex={4}
        totalButtons={TOTAL_BUTTONS}
        label="Receive"
        onPress={onReceive}
        style={[styles.actionButtonWide, styles.actionButtonHeight]}
      />
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  actionButtonHeight: {
    height: Sizes.actionButton.height
  },
  actionButtonNarrow: {
    width: '16.5%'
  },
  actionButtonWide: {
    width: '25.25%'
  }
})

export default SSButtonActionsGroup
