import { useMemo } from 'react'
import { StyleSheet, Text } from 'react-native'

import { Colors, Sizes, Typography } from '@/styles'
import { type TextFontSize } from '@/styles/sizes'

type SSTextProps = {
  color?: 'white' | 'black' | 'muted'
  size?: TextFontSize
  weight?: 'ultralight' | 'light' | 'regular' | 'medium' | 'bold'
  uppercase?: boolean
  center?: boolean
} & React.ComponentPropsWithoutRef<typeof Text>

type WeightStyle = {
  fontFamily: string
  fontWeight: '200' | '300' | '400' | '500' | '600'
}

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

    let weightStyle: WeightStyle = styles.textRegular
    if (weight === 'ultralight') weightStyle = { ...styles.textUltralight }
    if (weight === 'light') weightStyle = { ...styles.textLight }
    if (weight === 'medium') weightStyle = { ...styles.textMedium }
    if (weight === 'bold') weightStyle = { ...styles.textBold }

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
  textUltralight: {
    fontFamily: Typography.sfProTextUltralight,
    fontWeight: '200'
  },
  textLight: {
    fontFamily: Typography.sfProTextLight,
    fontWeight: '300'
  },
  textRegular: {
    fontFamily: Typography.sfProTextRegular,
    fontWeight: '400'
  },
  textMedium: {
    fontFamily: Typography.sfProTextMedium,
    fontWeight: '500'
  },
  textBold: {
    fontFamily: Typography.sfProTextBold,
    fontWeight: '600'
  }
})
