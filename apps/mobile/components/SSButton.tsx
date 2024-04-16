import { useMemo } from 'react'
import { TouchableOpacity, StyleSheet } from 'react-native'
import SSText from './SSText'
import { Colors, Sizes } from '@/styles'

type SSButtonProps = {
  label: string
  variant?: 'default' | 'secondary' | 'ghost'
} & React.ComponentPropsWithoutRef<typeof TouchableOpacity>

export default function SSButton({
  label,
  variant = 'default',
  style,
  ...props
}: SSButtonProps) {
  const buttonStyle = useMemo(() => {
    let buttonVariantStyles = styles.buttonDefault
    if (variant === 'secondary') buttonVariantStyles = styles.buttonSecondary
    if (variant === 'ghost') buttonVariantStyles = styles.buttonGhost

    return StyleSheet.compose(
      {
        ...styles.buttonBase,
        ...buttonVariantStyles
      },
      style
    )
  }, [variant, style])

  const textStyle = useMemo(() => {
    let textVariantStyles = styles.textDefault
    if (variant === 'secondary') textVariantStyles = styles.textSecondary
    if (variant === 'ghost') textVariantStyles = styles.textGhost

    return { ...textVariantStyles }
  }, [variant])

  return (
    <TouchableOpacity style={buttonStyle} activeOpacity={0.6} {...props}>
      <SSText uppercase style={textStyle}>
        {label}
      </SSText>
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
  textDefault: {
    color: Colors.white
  },
  textSecondary: {
    color: Colors.black
  },
  textGhost: {
    color: Colors.gray[200]
  }
})
