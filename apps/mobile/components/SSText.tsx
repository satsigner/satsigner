import { useMemo } from 'react'
import { StyleSheet, Text } from 'react-native'

import { Colors, Sizes, Typography } from '@/styles'
import { type TextFontSize, type TextFontWeight } from '@/styles/sizes'

export type SSTextProps = {
  color?: 'white' | 'black' | 'muted'
  size?: TextFontSize
  type?: 'sans-serif' | 'mono'
  weight?: TextFontWeight
  uppercase?: boolean
  center?: boolean
} & React.ComponentPropsWithoutRef<typeof Text>

function SSText({
  color = 'white',
  size = 'sm',
  type = 'sans-serif',
  weight = 'regular',
  uppercase,
  center,
  style,
  children,
  ...props
}: SSTextProps) {
  const textStyle = useMemo(() => {
    const colorStyle = {
      white: styles.textColorWhite,
      black: styles.textColorBlack,
      muted: styles.textColorMuted
    }[color]

    const styleMap = {
      mono: {
        ultralight: styles.textSFMonoRegular,
        light: styles.textSFMonoRegular,
        medium: styles.textSFMonoRegular,
        regular: styles.textSFMonoRegular,
        bold: styles.textSFMonoRegular
      },
      'sans-serif': {
        ultralight: styles.textSansSerifUltralight,
        light: styles.textSansSerifLight,
        medium: styles.textSansSerifMedium,
        regular: styles.textSansSerifRegular,
        bold: styles.textSansSerifBold
      }
    }

    return StyleSheet.compose(
      {
        ...styles.textBase,
        ...colorStyle,
        fontSize: Sizes.text.fontSize[size],
        fontWeight: Sizes.text.fontWeight[weight],
        fontFamily: styleMap[type][weight].fontFamily,
        ...(uppercase ? styles.uppercase : {}),
        ...(center ? styles.center : {})
      },
      style
    )
  }, [color, size, weight, uppercase, center, style, type])

  return (
    <Text style={textStyle} {...props}>
      {children}
    </Text>
  )
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
  textSansSerifUltralight: {
    fontFamily: Typography.sfProTextUltralight
  },
  textSansSerifLight: {
    fontFamily: Typography.sfProTextLight
  },
  textSansSerifRegular: {
    fontFamily: Typography.sfProTextRegular
  },
  textSansSerifMedium: {
    fontFamily: Typography.sfProTextMedium
  },
  textSansSerifBold: {
    fontFamily: Typography.sfProTextBold
  },
  textSFMonoRegular: {
    fontFamily: Typography.sfProMono
  }
})

export default SSText
