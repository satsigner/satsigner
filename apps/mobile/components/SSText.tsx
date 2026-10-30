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
      bold: styles.textMonoBold,
      light: styles.textMonoLight,
      medium: styles.textMonoMedium,
      regular: styles.textMonoRegular,
      ultralight: styles.textMonoUltralight
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
    color: Colors.gray[300]
  },
  textColorWhite: {
    color: Colors.white
  },
  textMonoBold: {
    fontFamily: Typography.geistMonoBold
  },
  textMonoLight: {
    fontFamily: Typography.geistMonoLight
  },
  textMonoMedium: {
    fontFamily: Typography.geistMonoMedium
  },
  textMonoRegular: {
    fontFamily: Typography.geistMonoRegular
  },
  textMonoUltralight: {
    fontFamily: Typography.geistMonoExtraLight
  },
  textSansSerifBold: {
    fontFamily: Typography.geistBold
  },
  textSansSerifLight: {
    fontFamily: Typography.geistLight
  },
  textSansSerifMedium: {
    fontFamily: Typography.geistMedium
  },
  textSansSerifRegular: {
    fontFamily: Typography.geistRegular
  },
  textSansSerifUltralight: {
    fontFamily: Typography.geistExtraLight
  },
  uppercase: {
    textTransform: 'uppercase'
  }
})

export default SSText
