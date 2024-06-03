import { Image } from 'expo-image'
import { useMemo } from 'react'
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  TextStyle,
  TouchableOpacity
} from 'react-native'

import { Colors, Sizes } from '@/styles'

import SSBackgroundGradient from './SSBackgroundGradient'
import SSText from './SSText'

type SSButtonProps = {
  label: string
  variant?: 'default' | 'secondary' | 'ghost' | 'gradient'
  loading?: boolean
  withSelect?: boolean
  textStyle?: StyleProp<TextStyle>
} & React.ComponentPropsWithoutRef<typeof TouchableOpacity>

export default function SSButton({
  label,
  variant = 'default',
  disabled,
  loading,
  withSelect,
  style,
  textStyle,
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

  const textStyles = useMemo(() => {
    let textVariantStyles = styles.textDefault
    if (variant === 'secondary') textVariantStyles = styles.textSecondary
    if (variant === 'ghost') textVariantStyles = styles.textGhost

    return StyleSheet.compose({ ...textVariantStyles }, textStyle)
  }, [variant, textStyle])

  const activityIndicatorColor = useMemo(() => {
    return variant === 'secondary'
      ? styles.activityIndicatorDark.color
      : styles.activityIndicatorLight.color
  }, [variant])

  return (
    <TouchableOpacity
      style={buttonStyle}
      activeOpacity={0.6}
      disabled={disabled || loading}
      {...props}
    >
      {variant === 'gradient' && (
        <SSBackgroundGradient
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        />
      )}
      {!loading ? (
        <SSText uppercase style={textStyles}>
          {label}
        </SSText>
      ) : (
        <ActivityIndicator color={activityIndicatorColor} />
      )}
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
  },
  activityIndicatorLight: {
    color: Colors.white
  },
  activityIndicatorDark: {
    color: Colors.black
  }
})
