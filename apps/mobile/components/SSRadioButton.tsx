import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native'

import { Colors, Sizes } from '@/styles'

import SSText from './SSText'

type SSRadioButtonProps = {
  variant?: 'default' | 'outline'
  label: string
  loading?: boolean
  selected: boolean
} & React.ComponentPropsWithoutRef<typeof TouchableOpacity>

function SSRadioButton({
  variant = 'default',
  label,
  loading,
  selected,
  disabled,
  style,
  ...props
}: SSRadioButtonProps) {
  const radioButtonVariantStyles = selected
    ? variant === 'default'
      ? styles.selectedDefault
      : styles.selectedOutline
    : variant === 'default'
      ? styles.unselectedDefault
      : styles.unselectedOutline

  return (
    <TouchableOpacity
      style={[
        styles.buttonBase,
        radioButtonVariantStyles,
        disabled && styles.disabled,
        style
      ]}
      activeOpacity={variant === 'default' ? 0.6 : 1}
      {...props}
    >
      {!loading ? (
        <SSText
          uppercase
          color={variant === 'outline' && !selected ? 'muted' : 'white'}
          weight={variant === 'outline' && selected ? 'bold' : 'regular'}
        >
          {label}
        </SSText>
      ) : (
        <ActivityIndicator color={Colors.gray[200]} />
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  buttonBase: {
    alignItems: 'center',
    borderRadius: Sizes.radioButton.borderRadius,
    flexDirection: 'row',
    height: Sizes.radioButton.height,
    justifyContent: 'center',
    width: '100%'
  },
  disabled: {
    opacity: 0.3
  },
  selectedDefault: {
    backgroundColor: Colors.gray[600],
    borderColor: 'rgba(255, 255, 255, 0.68)',
    borderStyle: 'solid',
    borderWidth: Sizes.radioButton.borderWidth
  },
  selectedOutline: {
    borderColor: Colors.white,
    borderWidth: Sizes.radioButton.borderWidth
  },
  unselectedDefault: {
    backgroundColor: Colors.gray[950],
    borderColor: Colors.gray[700],
    borderWidth: Sizes.radioButton.borderWidth
  },
  unselectedOutline: {
    borderColor: Colors.gray[700],
    borderWidth: Sizes.radioButton.borderWidth
  }
})

export default SSRadioButton
