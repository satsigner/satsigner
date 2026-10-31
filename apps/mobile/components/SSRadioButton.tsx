import { ActivityIndicator, StyleSheet } from 'react-native'

import { Colors, Sizes } from '@/styles'

import SSOutlineGlassBorders from './SSOutlineGlassBorders'
import SSPressable from './SSPressable'
import SSText from './SSText'

type SSRadioButtonProps = {
  variant?: 'default' | 'outline'
  label: string
  loading?: boolean
  selected: boolean
} & React.ComponentPropsWithoutRef<typeof SSPressable>

function SSRadioButton({
  variant = 'default',
  label,
  loading,
  selected,
  disabled,
  style,
  ...props
}: SSRadioButtonProps) {
  const radioButtonVariantStyles =
    variant === 'default'
      ? selected
        ? styles.selectedDefault
        : styles.unselectedDefault
      : undefined

  return (
    <SSPressable
      style={[
        styles.buttonBase,
        variant === 'outline' && styles.buttonOutline,
        radioButtonVariantStyles,
        disabled && styles.disabled,
        style
      ]}
      activeOpacity={variant === 'default' ? 0.6 : 1}
      disabled={disabled}
      {...props}
    >
      {variant === 'outline' ? <SSOutlineGlassBorders /> : null}
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
    </SSPressable>
  )
}

const styles = StyleSheet.create({
  buttonBase: {
    alignItems: 'center',
    borderRadius: Sizes.button.borderRadius,
    flexDirection: 'row',
    height: Sizes.button.height,
    justifyContent: 'center',
    width: '100%'
  },
  buttonOutline: {
    backgroundColor: Colors.transparent,
    borderWidth: 0,
    overflow: 'hidden'
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
  unselectedDefault: {
    backgroundColor: Colors.gray[950],
    borderColor: Colors.gray[700],
    borderWidth: Sizes.radioButton.borderWidth
  }
})

export default SSRadioButton
