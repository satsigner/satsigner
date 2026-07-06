import { useRef, useState } from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View
} from 'react-native'

import { Colors } from '@/styles'

type Anchor = {
  x: number
  y: number
  width: number
  height: number
}

type SSPopoverProps = {
  trigger: React.ReactNode
  children: React.ReactNode
  contentWidth?: number
  accessibilityLabel?: string
}

const POPOVER_GAP = 8
const SCREEN_EDGE_PADDING = 12
const DEFAULT_CONTENT_WIDTH = 240
const FALLBACK_TRIGGER_HEIGHT = 24

function SSPopover({
  trigger,
  children,
  contentWidth = DEFAULT_CONTENT_WIDTH,
  accessibilityLabel
}: SSPopoverProps) {
  const triggerRef = useRef<View>(null)
  const [visible, setVisible] = useState(false)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const { width: screenWidth } = useWindowDimensions()

  function handleOpen() {
    triggerRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      setAnchor({ height, width, x: pageX, y: pageY })
      setVisible(true)
    })
  }

  function handleClose() {
    setVisible(false)
  }

  const triggerHeight =
    anchor && anchor.height > 0 ? anchor.height : FALLBACK_TRIGGER_HEIGHT
  const top = anchor ? anchor.y + triggerHeight + POPOVER_GAP : 0
  const triggerRightEdge = anchor ? anchor.x + anchor.width : screenWidth
  const left = Math.max(
    SCREEN_EDGE_PADDING,
    Math.min(
      triggerRightEdge - contentWidth,
      screenWidth - contentWidth - SCREEN_EDGE_PADDING
    )
  )

  return (
    <View ref={triggerRef} collapsable={false}>
      <Pressable
        onPress={handleOpen}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        hitSlop={8}
      >
        {trigger}
      </Pressable>
      <Modal
        transparent
        statusBarTranslucent
        visible={visible}
        animationType="fade"
        onRequestClose={handleClose}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        {anchor ? (
          <View style={[styles.content, { left, top, width: contentWidth }]}>
            {children}
          </View>
        ) : null}
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
  },
  content: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[800],
    borderRadius: 8,
    borderWidth: 1,
    elevation: 8,
    padding: 16,
    position: 'absolute'
  }
})

export default SSPopover
