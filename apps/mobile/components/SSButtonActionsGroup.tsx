import { LinearGradient } from 'expo-linear-gradient'
import { StyleSheet, View } from 'react-native'

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

const GRADIENT_START = { x: 0, y: 0 }
const GRADIENT_END = { x: 1, y: 0 }

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
        <View style={[styles.buttonWrapper, styles.actionButtonCompactWide]}>
          <LinearGradient
            colors={[Colors.gray[880], Colors.gray[700]]}
            end={GRADIENT_END}
            start={GRADIENT_START}
            style={styles.topBorder}
          />
          <SSActionButton onPress={props.onSend} style={styles.actionButton}>
            <SSText uppercase>Send</SSText>
          </SSActionButton>
        </View>
        <View style={[styles.buttonWrapper, styles.actionButtonCompactNarrow]}>
          <LinearGradient
            colors={[Colors.gray[700], Colors.gray[700]]}
            end={GRADIENT_END}
            start={GRADIENT_START}
            style={styles.topBorder}
          />
          <SSActionButton onPress={props.onCamera} style={styles.actionButton}>
            <SSIconCamera height={13} width={18} />
          </SSActionButton>
        </View>
        <View style={[styles.buttonWrapper, styles.actionButtonCompactWide]}>
          <LinearGradient
            colors={[Colors.gray[700], Colors.gray[880]]}
            end={GRADIENT_END}
            start={GRADIENT_START}
            style={styles.topBorder}
          />
          <SSActionButton onPress={props.onReceive} style={styles.actionButton}>
            <SSText uppercase>Receive</SSText>
          </SSActionButton>
        </View>
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
      <View style={[styles.buttonWrapper, styles.actionButtonWide]}>
        <LinearGradient
          colors={[Colors.gray[880], Colors.gray[700]]}
          end={GRADIENT_END}
          start={GRADIENT_START}
          style={styles.topBorder}
        />
        <SSActionButton onPress={onSend} style={styles.actionButton}>
          <SSText uppercase>Send</SSText>
        </SSActionButton>
      </View>
      <View style={[styles.buttonWrapper, styles.actionButtonNarrow]}>
        <LinearGradient
          colors={[Colors.gray[850], Colors.gray[700]]}
          end={GRADIENT_END}
          start={GRADIENT_START}
          style={styles.topBorder}
        />
        <SSActionButton onPress={onPaste} style={styles.actionButton}>
          <SSIconPasteClipboard height={16} width={18} />
        </SSActionButton>
      </View>
      <View style={[styles.buttonWrapper, styles.actionButtonNarrow]}>
        <LinearGradient
          colors={[Colors.gray[700], Colors.gray[700]]}
          end={GRADIENT_END}
          start={GRADIENT_START}
          style={styles.topBorder}
        />
        <SSActionButton onPress={onCamera} style={styles.actionButton}>
          <SSIconCamera height={13} width={18} />
        </SSActionButton>
      </View>
      <View style={[styles.buttonWrapper, styles.actionButtonNarrow]}>
        <LinearGradient
          colors={[Colors.gray[700], Colors.gray[850]]}
          end={GRADIENT_END}
          start={GRADIENT_START}
          style={styles.topBorder}
        />
        <SSActionButton
          disabled={!nfcAvailable}
          onPress={onNFC}
          style={styles.actionButton}
        >
          <SSIconScanNFC height={21} width={18} />
        </SSActionButton>
      </View>
      <View style={[styles.buttonWrapper, styles.actionButtonWide]}>
        <LinearGradient
          colors={[Colors.gray[700], Colors.gray[880]]}
          end={GRADIENT_END}
          start={GRADIENT_START}
          style={styles.topBorder}
        />
        <SSActionButton onPress={onReceive} style={styles.actionButton}>
          <SSText uppercase>Receive</SSText>
        </SSActionButton>
      </View>
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  actionButton: {
    backgroundColor: Colors.gray[925]
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
  },
  buttonWrapper: {
    borderBottomColor: Colors.gray[950],
    borderBottomWidth: 1,
    borderLeftColor: Colors.gray[950],
    borderLeftWidth: 1,
    borderRadius: 4,
    borderRightColor: Colors.gray[950],
    borderRightWidth: 1,
    overflow: 'hidden'
  },
  topBorder: {
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1
  }
})

export default SSButtonActionsGroup
