import { LinearGradient } from 'expo-linear-gradient'
import {
  ActivityIndicator,
  type StyleProp,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
  TouchableOpacity,
  View
} from 'react-native'

import { Colors, Sizes } from '@/styles'

import { SSIconChevronDown } from './icons'
import SSBackgroundGradient from './SSBackgroundGradient'
import SSText from './SSText'

export type SSButtonProps = {
  label?: string
  icon?: React.ReactNode
  variant?:
    | 'default'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'subtle'
    | 'gradient'
    | 'elevated'
    | 'danger'
  loading?: boolean
  withSelect?: boolean
  uppercase?: boolean
  gradientType?: 'default' | 'special'
  textStyle?: StyleProp<TextStyle>
  horizontalIndex?: number
  totalButtons?: number
  verticalIndex?: number
  totalButtonsVertical?: number
} & React.ComponentPropsWithoutRef<typeof TouchableOpacity>

function getButtonVariantStyle(
  variant: SSButtonProps['variant'],
  withSelect?: boolean
): StyleProp<ViewStyle> {
  if (variant === 'secondary') {
    return styles.buttonSecondary
  }
  if (variant === 'outline') {
    return styles.buttonOutline
  }
  if (variant === 'ghost') {
    return styles.buttonGhost
  }
  if (variant === 'subtle') {
    return styles.buttonSubtle
  }
  if (variant === 'danger') {
    return styles.buttonDanger
  }
  if (variant === 'elevated') {
    return [styles.buttonDefault, styles.buttonElevated]
  }
  if (variant === 'default' && withSelect) {
    return styles.buttonWithSelect
  }
  return styles.buttonDefault
}

function getTextVariantStyle(variant: SSButtonProps['variant']) {
  if (variant === 'secondary') {
    return styles.textSecondary
  }
  if (variant === 'ghost') {
    return styles.textGhost
  }
  if (variant === 'subtle') {
    return styles.textSubtle
  }
  return styles.textDefault
}

function SSButton({
  label = '',
  icon,
  variant = 'default',
  loading,
  withSelect,
  uppercase = true,
  gradientType = 'default',
  textStyle,
  disabled,
  style,
  horizontalIndex,
  totalButtons,
  verticalIndex,
  totalButtonsVertical,
  ...props
}: SSButtonProps) {
  const buttonStyle = StyleSheet.compose(
    [
      styles.buttonBase,
      disabled ? styles.disabled : null,
      getButtonVariantStyle(variant, withSelect)
    ],
    style
  )

  const textStyles = StyleSheet.compose(getTextVariantStyle(variant), textStyle)

  const activityIndicatorColor =
    variant === 'secondary'
      ? styles.activityIndicatorDark.color
      : styles.activityIndicatorLight.color

  const showLinearGradient =
    variant === 'elevated' ||
    (variant === 'gradient' && gradientType === 'special')
  const showDefaultGradient =
    variant === 'gradient' && gradientType === 'default'

  return (
    <TouchableOpacity
      style={buttonStyle}
      activeOpacity={0.6}
      disabled={disabled || loading}
      {...props}
    >
      {showLinearGradient && (
        <LinearGradient
          style={styles.buttonGradient}
          colors={['#212121', '#1C1C1C']}
          end={{ x: 0, y: 1 }}
          start={{ x: 0, y: 0 }}
        />
      )}
      {variant === 'elevated' && (
        <>
          <LinearGradient
            style={[styles.glassBorder, styles.glassBorderTop]}
            colors={[
              'rgba(255,255,255,0.08)',
              'rgba(255,255,255,0.22)',
              'rgba(255,255,255,0.05)'
            ]}
            locations={[0, 0.35, 1]}
            start={{
              x:
                horizontalIndex !== undefined && totalButtons !== undefined
                  ? -horizontalIndex
                  : 0,
              y: 0
            }}
            end={{
              x:
                horizontalIndex !== undefined && totalButtons !== undefined
                  ? totalButtons - horizontalIndex
                  : 1,
              y: 0
            }}
          />
          <LinearGradient
            style={[styles.glassBorder, styles.glassBorderBottom]}
            colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <LinearGradient
            style={[styles.glassBorder, styles.glassBorderLeft]}
            colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.04)']}
            start={{
              x: 0,
              y:
                verticalIndex !== undefined &&
                totalButtonsVertical !== undefined
                  ? -verticalIndex
                  : 0
            }}
            end={{
              x: 0,
              y:
                verticalIndex !== undefined &&
                totalButtonsVertical !== undefined
                  ? totalButtonsVertical - verticalIndex
                  : 1
            }}
          />
          <LinearGradient
            style={[styles.glassBorder, styles.glassBorderRight]}
            colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.02)']}
            start={{
              x: 0,
              y:
                verticalIndex !== undefined &&
                totalButtonsVertical !== undefined
                  ? -verticalIndex
                  : 0
            }}
            end={{
              x: 0,
              y:
                verticalIndex !== undefined &&
                totalButtonsVertical !== undefined
                  ? totalButtonsVertical - verticalIndex
                  : 1
            }}
          />
        </>
      )}
      {showDefaultGradient && (
        <SSBackgroundGradient style={styles.buttonGradient} />
      )}
      {!loading ? (
        icon ? (
          icon
        ) : (
          <SSText
            uppercase={uppercase}
            center
            style={[textStyles, { width: '100%' }]}
          >
            {label}
          </SSText>
        )
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
  activityIndicatorDark: {
    color: Colors.black
  },
  activityIndicatorLight: {
    color: Colors.white
  },
  buttonBase: {
    alignItems: 'center',
    borderRadius: Sizes.button.borderRadius,
    flexDirection: 'row',
    height: Sizes.button.height,
    justifyContent: 'center',
    width: '100%'
  },
  buttonDanger: {
    backgroundColor: Colors.error
  },
  buttonDefault: {
    backgroundColor: Colors.gray[600]
  },
  buttonElevated: {
    borderRadius: Sizes.button.borderRadius,
    overflow: 'hidden'
  },
  buttonGhost: {
    backgroundColor: Colors.transparent
  },
  buttonGradient: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    position: 'absolute',
    width: '100%'
  },
  buttonOutline: {
    backgroundColor: Colors.transparent,
    borderColor: Colors.white,
    borderWidth: 1
  },
  buttonSecondary: {
    backgroundColor: Colors.white
  },
  buttonSubtle: {
    backgroundColor: Colors.gray[900]
  },
  buttonWithSelect: {
    backgroundColor: Colors.gray[850]
  },
  disabled: {
    opacity: 0.3
  },
  glassBorder: {
    position: 'absolute'
  },
  glassBorderBottom: {
    bottom: 0,
    height: 1,
    left: 0,
    right: 0
  },
  glassBorderLeft: {
    bottom: 0,
    left: 0,
    top: 0,
    width: 1
  },
  glassBorderRight: {
    bottom: 0,
    right: 0,
    top: 0,
    width: 1
  },
  glassBorderTop: {
    height: 1,
    left: 0,
    right: 0,
    top: 0
  },
  textDefault: {
    color: Colors.white,
    letterSpacing: 1
  },
  textGhost: {
    color: Colors.gray[200],
    letterSpacing: 1
  },
  textSecondary: {
    color: Colors.black,
    letterSpacing: 1
  },
  textSubtle: {
    color: Colors.gray[100],
    letterSpacing: 1
  }
})

export default SSButton
