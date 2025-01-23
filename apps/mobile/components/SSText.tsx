import { useMemo } from 'react'
import { StyleSheet, Text } from 'react-native'

import { Colors, Sizes, Typography } from '@/styles'
import { type TextFontSize } from '@/styles/sizes'

type SSTextProps = {
  color?: 'white' | 'black' | 'muted'
  size?: TextFontSize
  type?: 'sans-serif' | 'mono'
  weight?: 'ultralight' | 'light' | 'regular' | 'medium' | 'bold'
  uppercase?: boolean
  center?: boolean
} & React.ComponentPropsWithoutRef<typeof Text>

type WeightStyle = {
  fontWeight: '200' | '300' | '400' | '500' | '700'
}

export default function SSText({
  color = 'white',
  size = 'sm',
  weight = 'regular',
  type = 'sans-serif',
  uppercase,
  center,
  style,
  children
}: SSTextProps) {
  const textStyle = useMemo(() => {
    let colorStyle = styles.textColorWhite
    if (color === 'black') colorStyle = styles.textColorBlack
    if (color === 'muted') colorStyle = styles.textColorMuted

    const styleMap = {
      mono: {
        ultralight: styles.textMonoUltralight,
        light: styles.textMonoLight,
        medium: styles.textMonoMedium,
        regular: styles.textMonoRegular,
        bold: styles.textMonoBold
      },
      'sans-serif': {
        ultralight: styles.textSansSerifUltralight,
        light: styles.textSansSerifLight,
        medium: styles.textSansSerifMedium,
        regular: styles.textSansSerifRegular,
        bold: styles.textSansSerifBold
      }
    }

    const textWeightStyle = styleMap[type][weight] as WeightStyle

    return StyleSheet.compose(
      {
        ...styles.textBase,
        ...colorStyle,
        ...{ fontSize: Sizes.text.fontSize[size] },
        ...textWeightStyle,
        ...(uppercase ? styles.uppercase : {}),
        ...(center ? styles.center : {})
      },
      style
    )
  }, [color, size, weight, uppercase, center, style, type])

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
  textSansSerifUltralight: {
    fontFamily: Typography.sfProTextUltralight,
    fontWeight: '200'
  },
  textSansSerifLight: {
    fontFamily: Typography.sfProTextLight,
    fontWeight: '300'
  },
  textSansSerifRegular: {
    fontFamily: Typography.sfProTextRegular,
    fontWeight: '400'
  },
  textSansSerifMedium: {
    fontFamily: Typography.sfProTextMedium,
    fontWeight: '500'
  },
  textSansSerifBold: {
    fontFamily: Typography.sfProTextBold,
    fontWeight: '700'
  },
  textMonoUltralight: {
    fontFamily: Typography.terminessNerdFontMonoRegular,
    fontWeight: '200'
  },
  textMonoLight: {
    fontFamily: Typography.terminessNerdFontMonoRegular,
    fontWeight: '300'
  },
  textMonoRegular: {
    fontFamily: Typography.terminessNerdFontMonoRegular,
    fontWeight: '400'
  },
  textMonoMedium: {
    fontFamily: Typography.terminessNerdFontMonoRegular,
    fontWeight: '500'
  },
  textMonoBold: {
    fontFamily: Typography.terminessNerdFontMonoBold,
    fontWeight: '700'
  }
})
