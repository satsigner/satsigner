import { StyleSheet, useWindowDimensions, View } from 'react-native'

import SSButton from '@/components/SSButton'

const PILL_BOTTOM_OFFSET = 12
// SSButton lays its label out absolutely, so the pill needs a set width. It
// grows with the system font size so the label is not cut off.
const PILL_WIDTH = 200
const PILL_SIDE_MARGIN = 16

function pillWidth(fontScale: number, windowWidth: number) {
  return Math.min(
    PILL_WIDTH * Math.max(1, fontScale),
    windowWidth - PILL_SIDE_MARGIN * 2
  )
}

type SSNewMessagesPillProps = {
  label: string
  onPress: () => void
}

/** Floats over the bottom of the message list, above the composer. */
function SSNewMessagesPill({ label, onPress }: SSNewMessagesPillProps) {
  const { fontScale, width } = useWindowDimensions()
  return (
    <View pointerEvents="box-none" style={styles.container}>
      <View style={{ width: pillWidth(fontScale, width) }}>
        <SSButton label={label} onPress={onPress} variant="secondary" />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    bottom: PILL_BOTTOM_OFFSET,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 2
  }
})

export default SSNewMessagesPill
