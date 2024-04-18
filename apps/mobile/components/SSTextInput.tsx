import { useMemo } from 'react'
import { StyleSheet, TextInput } from 'react-native'

import { Colors, Sizes } from '@/styles'

type SSTextInputProps = React.ComponentPropsWithoutRef<typeof TextInput>

export default function SSTextInput({ style, ...props }: SSTextInputProps) {
  const textInputStyle = useMemo(() => {
    return StyleSheet.compose(
      {
        ...styles.textInputBase
      },
      style
    )
  }, [style])

  return <TextInput style={textInputStyle} {...props} />
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
  }
})
