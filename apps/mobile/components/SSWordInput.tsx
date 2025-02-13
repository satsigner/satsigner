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
  const textInputStyle = useMemo(() => {
    return StyleSheet.compose(
      {
        ...styles.textInputBase,
        ...(invalid ? styles.textInputInvalid : {})
      },
      style
    )
  }, [invalid, style])

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
  textInputInvalid: {
    borderWidth: 2,
    borderColor: Colors.error
  },
  wordPositionLabelBase: {
    color: Colors.gray[200],
    position: 'absolute',
    top: 5,
    left: 5,
    lineHeight: Sizes.wordInput.lineHeight
  }
})

export default forwardRef(SSWordInput)
