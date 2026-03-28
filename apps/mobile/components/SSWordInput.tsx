import { type ForwardedRef, forwardRef, useMemo } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'

import { Colors, Sizes } from '@/styles'

import SSText from './SSText'

type SSWordInputProps = {
  value?: string
  invalid?: boolean
  position: number
  editable?: boolean
  index: number
} & React.ComponentPropsWithoutRef<typeof TextInput>

function SSWordInput(
  {
    value,
    invalid,
    position,
    editable = true,
    index,
    style,
    ...props
  }: SSWordInputProps,
  ref: ForwardedRef<TextInput>
) {
  const textInputStyle = useMemo(
    () =>
      StyleSheet.compose(
        {
          ...styles.textInputBase,
          ...(invalid ? styles.textInputInvalid : {})
        },
        style
      ),
    [invalid, style]
  )

  return (
    <View style={styles.containerBase}>
      <TextInput
        style={textInputStyle}
        value={value}
        autoFocus={index === 0}
        ref={ref}
        editable={editable}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect={false}
        spellCheck={false}
        {...props}
      />
      <SSText style={styles.wordPositionLabelBase}>{position}</SSText>
    </View>
  )
}

const styles = StyleSheet.create({
  containerBase: {
    alignContent: 'center',
    height: Sizes.wordInput.height,
    justifyContent: 'flex-start',
    width: '32%'
  },
  textInputBase: {
    backgroundColor: Colors.gray[850],
    borderRadius: Sizes.wordInput.borderRadius,
    color: Colors.white,
    fontSize: Sizes.wordInput.fontSize,
    height: Sizes.wordInput.height,
    textAlign: 'center'
  },
  textInputInvalid: {
    borderColor: Colors.error,
    borderWidth: 2
  },
  wordPositionLabelBase: {
    color: Colors.gray[200],
    left: 5,
    lineHeight: Sizes.wordInput.lineHeight,
    position: 'absolute',
    top: 5
  }
})

export default forwardRef(SSWordInput)
