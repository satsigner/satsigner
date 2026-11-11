import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'

const PILL_BOTTOM_OFFSET = 12
// SSButton lays its label out absolutely, so the pill needs a set width.
const PILL_WIDTH = 200

type SSNewMessagesPillProps = {
  label: string
  onPress: () => void
}

/** Floats over the bottom of the message list, above the composer. */
function SSNewMessagesPill({ label, onPress }: SSNewMessagesPillProps) {
  return (
    <View pointerEvents="box-none" style={styles.container}>
      <View style={styles.pill}>
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
  },
  pill: {
    width: PILL_WIDTH
  }
})

export default SSNewMessagesPill
