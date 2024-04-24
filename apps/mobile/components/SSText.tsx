import { useMemo } from 'react'
import { StyleSheet, Text } from 'react-native'

import { Colors, Sizes, Typography } from '@/styles'
import { type TextFontSize } from '@/styles/sizes'

type SSTextProps = {
  color?: 'white' | 'black' | 'muted'
  size?: TextFontSize
  weight?: 'light' | 'regular' | 'medium' | 'bold'
  uppercase?: boolean
  center?: boolean
} & React.ComponentPropsWithoutRef<typeof Text>

export default function SSText({
  color = 'white',
  size = 'sm',
  weight = 'regular',
  uppercase,
  center,
  style,
  children
}: SSTextProps) {
  const textStyle = useMemo(() => {
    let colorStyle = styles.textColorWhite
    if (color === 'black') colorStyle = styles.textColorBlack
    if (color === 'muted') colorStyle = styles.textColorMuted

    let weightStyle = styles.textRegular
    if (weight === 'light') weightStyle = styles.textLight
    if (weight === 'medium') weightStyle = styles.textMedium
    if (weight === 'bold') weightStyle = styles.textBold

    return StyleSheet.compose(
      {
        ...styles.textBase,
        ...colorStyle,
        ...{ fontSize: Sizes.text.fontSize[size] },
        ...weightStyle,
        ...(uppercase ? styles.uppercase : {}),
        ...(center ? styles.center : {})
      },
      style
    )
  }, [color, size, weight, uppercase, center, style])

  return <Text style={textStyle}>{children}</Text>
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
  center: {
    textAlign: 'center'
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
