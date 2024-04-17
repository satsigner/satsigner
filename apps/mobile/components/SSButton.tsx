import { Image } from 'expo-image'
import { useMemo } from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'

import { Colors, Sizes } from '@/styles'

import SSText from './SSText'

type SSButtonProps = {
  label: string
  variant?: 'default' | 'secondary' | 'ghost'
  withSelect?: boolean
} & React.ComponentPropsWithoutRef<typeof TouchableOpacity>

export default function SSButton({
  label,
  variant = 'default',
  disabled,
  withSelect,
  style,
  ...props
}: SSButtonProps) {
  const buttonStyle = useMemo(() => {
    let buttonVariantStyles = styles.buttonDefault
    if (variant === 'secondary') buttonVariantStyles = styles.buttonSecondary
    if (variant === 'ghost') buttonVariantStyles = styles.buttonGhost
    if (variant === 'default' && withSelect)
      buttonVariantStyles = styles.buttonWithSelect

    return StyleSheet.compose(
      {
        ...styles.buttonBase,
        ...(disabled ? styles.disabled : {}),
        ...buttonVariantStyles
      },
      style
    )
  }, [variant, disabled, withSelect, style])

  const textStyle = useMemo(() => {
    let textVariantStyles = styles.textDefault
    if (variant === 'secondary') textVariantStyles = styles.textSecondary
    if (variant === 'ghost') textVariantStyles = styles.textGhost

    return textVariantStyles
  }, [variant])

  return (
    <TouchableOpacity
      style={buttonStyle}
      activeOpacity={0.6}
      disabled={disabled}
      {...props}
    >
      <SSText uppercase style={textStyle}>
        {label}
      </SSText>
      {withSelect && (
        <Image
          style={{
            position: 'absolute',
            right: 15,
            top: 28,
            width: 11.6,
            height: 5
          }}
          source={require('@/assets/icons/chevron-down.svg')}
        />
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  buttonBase: {
    borderRadius: Sizes.button.borderRadius,
    height: Sizes.button.height,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  buttonDefault: {
    backgroundColor: Colors.gray[600]
  },
  buttonSecondary: {
    backgroundColor: Colors.white
  },
  buttonGhost: {
    backgroundColor: Colors.transparent
  },
  buttonWithSelect: {
    backgroundColor: Colors.gray[850]
  },
  textDefault: {
    color: Colors.white
  },
  textSecondary: {
    color: Colors.black
  },
  textGhost: {
    color: Colors.gray[200]
  },
  disabled: {
    opacity: 0.3
  }
})
