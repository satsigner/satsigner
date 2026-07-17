import { Colors } from '@/styles'
import { text, type TextFontSize, type TextFontWeight } from '@/styles/sizes'
import { formatNumber } from '@/utils/format'

import SSText from './SSText'

type SSStyledSatTextProps = {
  amount: number
  decimals?: number
  useZeroPadding?: boolean
  currency?: 'sats' | 'btc'
  type?: 'send' | 'receive'
  noColor?: boolean
  showSign?: boolean
  textSize?: TextFontSize
  weight?: TextFontWeight
  letterSpacing?: number
}

function SSStyledSatText({
  amount,
  decimals = 0,
  useZeroPadding = false,
  currency = 'sats',
  type = 'send',
  noColor = true,
  showSign = true,
  textSize = '3xl',
  weight = 'regular',
  letterSpacing = -0.1
}: SSStyledSatTextProps) {
  const zeroPadding = useZeroPadding || currency === 'btc'
  const formatted = formatNumber(amount, decimals, zeroPadding)
  const spacedFormatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ')

  const firstNonZeroIndex =
    spacedFormatted.search(/[1-9]/) === -1
      ? spacedFormatted.length
      : spacedFormatted.search(/[1-9]/)

  const leading = spacedFormatted.slice(0, firstNonZeroIndex)
  const rest = spacedFormatted.slice(firstNonZeroIndex)
  const hasLeading = leading.length > 0
  const baseStyle = { letterSpacing, lineHeight: text.fontSize[textSize] }

  const leadingColor = noColor
    ? Colors.softWhite
    : zeroPadding && hasLeading
      ? type === 'send'
        ? Colors.softBarRed
        : Colors.softBarGreen
      : type === 'send'
        ? Colors.softRed
        : Colors.softGreen
  const mainColor = noColor
    ? Colors.white
    : type === 'send'
      ? Colors.mainRed
      : Colors.mainGreen

  return (
    <SSText size={textSize}>
      {type === 'send' && !noColor && showSign && (
        <SSText
          size={textSize}
          weight="medium"
          style={{ color: Colors.mainRed, marginRight: 2, opacity: 0.78 }}
        >
          -
        </SSText>
      )}
      {leading !== '' && (
        <SSText
          size={textSize}
          weight={weight}
          style={{ color: leadingColor, ...baseStyle }}
        >
          {leading}
        </SSText>
      )}
      {rest !== '' && (
        <SSText
          size={textSize}
          weight={weight}
          style={{ color: mainColor, ...baseStyle }}
        >
          {rest}
        </SSText>
      )}
    </SSText>
  )
}

export default SSStyledSatText
