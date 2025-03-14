import { useMemo } from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'

import { Colors, Sizes } from '@/styles'

import SSText from './SSText'

type SSRadioButtonProps = {
  variant?: 'default' | 'outline'
  label: string
  selected: boolean
} & React.ComponentPropsWithoutRef<typeof TouchableOpacity>

function SSRadioButton({
  variant = 'default',
  label,
  selected,
  disabled,
  style,
  ...props
}: SSRadioButtonProps) {
  const radioButtonStyle = useMemo(() => {
    const radioButtonVariantStyles = selected
      ? variant === 'default'
        ? styles.selectedDefault
        : styles.selectedOutline
      : variant === 'default'
        ? styles.unselectedDefault
        : styles.unselectedOutline

    return StyleSheet.compose(
      {
        ...styles.buttonBase,
        ...radioButtonVariantStyles,
        ...(disabled ? styles.disabled : {})
      },
      style
    )
  }, [variant, selected, disabled, style])

  return (
    <TouchableOpacity
      style={radioButtonStyle}
      activeOpacity={variant === 'default' ? 0.6 : 1}
      {...props}
    >
      <SSText
        uppercase
        color={variant === 'outline' && !selected ? 'muted' : 'white'}
        weight={variant === 'outline' && selected ? 'bold' : 'regular'}
      >
        {label}
      </SSText>
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
  selectedDefault: {
    backgroundColor: Colors.gray[600],
    borderWidth: Sizes.radioButton.borderWidth,
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.68)'
  },
  unselectedDefault: {
    backgroundColor: Colors.gray[950]
  },
  selectedOutline: {
    borderWidth: Sizes.radioButton.borderWidth,
    borderColor: Colors.white
  },
  unselectedOutline: {
    borderWidth: Sizes.radioButton.borderWidth,
    borderColor: Colors.gray[700]
  },
  disabled: {
    opacity: 0.3
  }
})

export default SSRadioButton
