import { StyleSheet, TextInput, View } from 'react-native'

import { Colors, Sizes } from '@/styles'

import SSText from './SSText'

type SSWordInputProps = {
  position: number
}

export default function SSWordInput({ position }: SSWordInputProps) {
  return (
    <View style={styles.containerBase}>
      <TextInput style={styles.textInputBase} />
      <SSText style={styles.wordPositionLabelBase}>{position}</SSText>
    </View>
  )
}

const styles = StyleSheet.create({
  containerBase: {
    height: Sizes.wordInput.height,
    width: '32%',
    justifyContent: 'flex-start',
    alignContent: 'center'
  },
  textInputBase: {
    borderRadius: Sizes.wordInput.borderRadius,
    height: Sizes.wordInput.height,
    textAlign: 'center',
    backgroundColor: Colors.gray[850],
    color: Colors.white,
    fontSize: Sizes.wordInput.fontSize
  },
  wordPositionLabelBase: {
    color: Colors.gray[200],
    position: 'absolute',
    top: 5,
    left: 5,
    lineHeight: Sizes.wordInput.lineHeight
  }
})