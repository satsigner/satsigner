import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'

const PILL_BOTTOM_OFFSET = 12

type SSNewMessagesPillProps = {
  label: string
  onPress: () => void
}

/** Floats over the bottom of the message list, above the composer. */
function SSNewMessagesPill({ label, onPress }: SSNewMessagesPillProps) {
  return (
    <View style={styles.container}>
      <SSButton label={label} onPress={onPress} variant="secondary" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    bottom: PILL_BOTTOM_OFFSET,
    position: 'absolute',
    zIndex: 2
  }
})

export default SSNewMessagesPill
