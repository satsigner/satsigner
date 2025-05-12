import { LinearGradient } from 'expo-linear-gradient'
import { useMemo } from 'react'
import {
  ActivityIndicator,
  type StyleProp,
  StyleSheet,
  type TextStyle,
  TouchableOpacity,
  View
} from 'react-native'

import { Colors, Sizes } from '@/styles'

import { SSIconChevronDown } from './icons'
import SSBackgroundGradient from './SSBackgroundGradient'
import SSText from './SSText'

export type SSButtonProps = {
  label: string
  variant?:
    | 'default'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'subtle'
    | 'gradient'
    | 'danger'
  loading?: boolean
  withSelect?: boolean
  uppercase?: boolean
  gradientType?: 'default' | 'special'
  textStyle?: StyleProp<TextStyle>
} & React.ComponentPropsWithoutRef<typeof TouchableOpacity>

function SSButton({
  label,
  variant = 'default',
  loading,
  withSelect,
  uppercase = true,
  gradientType = 'default',
  textStyle,
  disabled,
  style,
  ...props
}: SSButtonProps) {
  const buttonStyle = useMemo(() => {
    let buttonVariantStyles = styles.buttonDefault
    if (variant === 'secondary') buttonVariantStyles = styles.buttonSecondary
    if (variant === 'outline') buttonVariantStyles = styles.buttonOutline
    if (variant === 'ghost') buttonVariantStyles = styles.buttonGhost
    if (variant === 'subtle') buttonVariantStyles = styles.buttonSubtle
    if (variant === 'default' && withSelect)
      buttonVariantStyles = styles.buttonWithSelect
    if (variant === 'danger') buttonVariantStyles = styles.buttonDanger

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
    if (variant === 'subtle') textVariantStyles = styles.textSubtle

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
      {variant === 'gradient' &&
        (gradientType === 'default' ? (
          <SSBackgroundGradient style={styles.buttonGradient} />
        ) : (
          <LinearGradient
            style={styles.buttonGradient}
            colors={['#212121', '#1C1C1C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
        ))}
      {!loading ? (
        <SSText uppercase={uppercase} style={textStyles}>
          {label}
        </SSText>
      ) : (
        <ActivityIndicator color={activityIndicatorColor} />
      )}
      {withSelect && (
        <View
          style={{
            position: 'absolute',
            right: 15,
            top: 28
          }}
        >
          <SSIconChevronDown height={5} width={11.6} />
        </View>
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
  buttonOutline: {
    backgroundColor: Colors.transparent,
    borderWidth: 1,
    borderColor: Colors.white
  },
  buttonGhost: {
    backgroundColor: Colors.transparent
  },
  buttonSubtle: {
    backgroundColor: Colors.gray[900]
  },
  buttonGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center'
  },
  buttonDanger: {
    backgroundColor: Colors.error
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
  textSubtle: {
    color: Colors.gray[100]
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

export default SSButton
