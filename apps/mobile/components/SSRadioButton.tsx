import { useMemo } from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'

import { Colors, Sizes } from '@/styles'

import SSText from './SSText'

type SSRadioButtonProps = {
  label: string
  selected: boolean
} & React.ComponentPropsWithoutRef<typeof TouchableOpacity>

function SSRadioButton({
  label,
  selected,
  disabled,
  style,
  ...props
}: SSRadioButtonProps) {
  const buttonStyle = useMemo(() => {
    return StyleSheet.compose(
      {
        ...styles.buttonBase,
        ...(selected ? styles.selected : styles.unselected),
        ...(disabled ? styles.disabled : {})
      },
      style
    )
  }, [selected, disabled, style])

  return (
    <TouchableOpacity style={buttonStyle} activeOpacity={0.6} {...props}>
      <SSText uppercase>{label}</SSText>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  buttonBase: {
    borderRadius: Sizes.radioButton.borderRadius,
    height: Sizes.radioButton.height,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  selected: {
    backgroundColor: Colors.gray[600],
    borderWidth: Sizes.radioButton.borderWidth,
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.68)'
  },
  unselected: {
    backgroundColor: Colors.gray[950]
  },
  disabled: {
    opacity: 0.3
  }
})

export default SSRadioButton
