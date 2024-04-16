import { Text, StyleSheet } from 'react-native'
import { Sizes, Typography } from '@/styles'
import { useMemo } from 'react'

type SSTextProps = {
  uppercase?: boolean
  weight?: 'light' | 'regular' | 'medium' | 'bold'
} & React.ComponentPropsWithoutRef<typeof Text>

export default function SSText({
  weight = 'regular',
  uppercase,
  style,
  children
}: SSTextProps) {
  const textStyles = useMemo(() => {
    let weightStyles = styles.textRegular
    if (weight === 'light') weightStyles = styles.textLight
    if (weight === 'medium') weightStyles = styles.textMedium
    if (weight === 'bold') weightStyles = styles.textBold

    return StyleSheet.compose(
      {
        ...styles.textBase,
        ...weightStyles,
        ...(uppercase ? styles.uppercase : {})
      },
      style
    )
  }, [uppercase])

  return <Text style={textStyles}>{children}</Text>
}

const styles = StyleSheet.create({
  textBase: {
    fontSize: Sizes.button.fontSize
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
