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
  const colorStyle = {
    black: styles.textColorBlack,
    muted: styles.textColorMuted,
    white: styles.textColorWhite
  }[color]

  const styleMap = {
    mono: {
      bold: styles.textSFMonoRegular,
      light: styles.textSFMonoRegular,
      medium: styles.textSFMonoRegular,
      regular: styles.textSFMonoRegular,
      ultralight: styles.textSFMonoRegular
    },
    'sans-serif': {
      bold: styles.textSansSerifBold,
      light: styles.textSansSerifLight,
      medium: styles.textSansSerifMedium,
      regular: styles.textSansSerifRegular,
      ultralight: styles.textSansSerifUltralight
    }
  }

  return (
    <Text
      style={[
        styles.textBase,
        colorStyle,
        { fontFamily: styleMap[type][weight].fontFamily },
        { fontSize: Sizes.text.fontSize[size] },
        { fontWeight: Sizes.text.fontWeight[weight] },
        uppercase && styles.uppercase,
        center && styles.center,
        style
      ]}
      {...props}
    >
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center'
  },
  textBase: {
    fontSize: Sizes.button.fontSize
  },
  textColorBlack: {
    color: Colors.black
  },
  textColorMuted: {
    color: Colors.gray[100]
  },
  textColorWhite: {
    color: Colors.white
  },
  textSFMonoRegular: {
    fontFamily: Typography.sfProMono
  },
  textSansSerifBold: {
    fontFamily: Typography.sfProTextBold
  },
  textSansSerifLight: {
    fontFamily: Typography.sfProTextLight
  },
  textSansSerifMedium: {
    fontFamily: Typography.sfProTextMedium
  },
  textSansSerifRegular: {
    fontFamily: Typography.sfProTextRegular
  },
  textSansSerifUltralight: {
    fontFamily: Typography.sfProTextUltralight
  },
  uppercase: {
    textTransform: 'uppercase'
  }
})

export default SSText
