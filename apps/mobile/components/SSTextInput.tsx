import { Colors, Sizes } from '@/styles'
import { useMemo } from 'react'
import { TextInput, StyleSheet, View } from 'react-native'
import SSText from './SSText'

type SSTextInputProps = {
  label: string
} & React.ComponentPropsWithoutRef<typeof TextInput>

export default function SSTextInput({
  label,
  style,
  ...props
}: SSTextInputProps) {
  const textInputStyle = useMemo(() => {
    return StyleSheet.compose(
      {
        ...styles.textInputBase
      },
      style
    )
  }, [style])

  return (
    <View style={styles.containerBase}>
      <SSText color="white" style={styles.labelBase}>
        {label}
      </SSText>
      <TextInput style={textInputStyle} {...props} />
    </View>
  )
}

const styles = StyleSheet.create({
  textInputBase: {
    borderRadius: Sizes.textInput.borderRadius,
    height: Sizes.textInput.height,
    width: '100%',
    textAlign: 'center',
    backgroundColor: Colors.gray[850],
    color: Colors.white,
    fontSize: Sizes.textInput.fontSize
  },
  labelBase: {
    alignSelf: 'center'
  },
  containerBase: {
    flex: 1,
    flexDirection: 'column',
    gap: 8
  }
})
