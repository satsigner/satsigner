import { Text, StyleSheet } from 'react-native'
import { Colors, Sizes, Typography } from '@/styles'
import { useMemo } from 'react'

type SSTextProps = {
  uppercase?: boolean
  color?: 'white' | 'black' | 'muted'
  weight?: 'light' | 'regular' | 'medium' | 'bold'
} & React.ComponentPropsWithoutRef<typeof Text>

export default function SSText({
  color = 'white',
  weight = 'regular',
  uppercase,
  style,
  children
}: SSTextProps) {
  const textStyles = useMemo(() => {
    let colorStyles = styles.textColorWhite
    if (color === 'black') colorStyles = styles.textColorBlack
    if (color === 'muted') colorStyles = styles.textColorMuted

    let weightStyles = styles.textRegular
    if (weight === 'light') weightStyles = styles.textLight
    if (weight === 'medium') weightStyles = styles.textMedium
    if (weight === 'bold') weightStyles = styles.textBold

    return StyleSheet.compose(
      {
        ...styles.textBase,
        ...colorStyles,
        ...weightStyles,
        ...(uppercase ? styles.uppercase : {})
      },
      style
    )
  }, [weight, uppercase, style])

  return <Text style={textStyles}>{children}</Text>
}

const styles = StyleSheet.create({
  textBase: {
    fontSize: Sizes.button.fontSize
  },
  textColorWhite: {
    color: Colors.white
  },
  textColorBlack: {
    color: Colors.black
  },
  textColorMuted: {
    color: Colors.gray[200]
  },
  uppercase: {
    textTransform: 'uppercase'
  },
  textLight: {
    fontFamily: Typography.sfProTextLight
  },
  textRegular: {
    fontFamily: Typography.sfProTextRegular
  },
  textMedium: {
    fontFamily: Typography.sfProTextMedium
  },
  textBold: {
    fontFamily: Typography.sfProTextBold
  }
})
