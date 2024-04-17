import { useMemo } from 'react'
import { StyleSheet, Text } from 'react-native'

import { Colors, Sizes, Typography } from '@/styles'

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
        ...weightStyle,
        ...(uppercase ? styles.uppercase : {})
      },
      style
    )
  }, [color, weight, uppercase, style])

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
