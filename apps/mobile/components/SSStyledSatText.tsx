import { Colors } from '@/styles'
import { text } from '@/styles/sizes';
import type { TextFontSize, TextFontWeight } from '@/styles/sizes';
import { formatNumber } from '@/utils/format'

import SSText from './SSText'

interface SSStyledSatTextProps {
  amount: number
  decimals?: number
  useZeroPadding?: boolean
  currency?: 'sats' | 'btc'
  type?: 'send' | 'receive'
  noColor?: boolean
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
  textSize = '3xl',
  weight = 'regular',
  letterSpacing = -0.1
}: SSStyledSatTextProps) {
  const zeroPadding = useZeroPadding || currency === 'btc'
  const formatted = formatNumber(amount, decimals, zeroPadding)
  const spacedFormatted = formatted.replaceAll(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ')

  const firstNonZeroIndex =
    spacedFormatted.search(/[1-9]/) === -1
      ? spacedFormatted.length
      : spacedFormatted.search(/[1-9]/)

  return (
    <SSText size={textSize}>
      {type === 'send' && !noColor && (
        <SSText size={textSize} style={{ color: Colors.softRed }}>
          -
        </SSText>
      )}
      {[...spacedFormatted].map((char, index) => {
        const isBeforeFirstNonZero = index < firstNonZeroIndex

        return (
          <SSText
            key={index}
            size={textSize}
            weight={weight}
            style={{
              color: noColor
                ? isBeforeFirstNonZero
                  ? Colors.softWhite
                  : Colors.white
                : type === 'send'
                  ? isBeforeFirstNonZero
                    ? Colors.softRed
                    : Colors.mainRed
                  : isBeforeFirstNonZero
                    ? Colors.softGreen
                    : Colors.mainGreen,
              letterSpacing,
              lineHeight: text.fontSize[textSize]
            }}
          >
            {char}
          </SSText>
        )
      })}
    </SSText>
  )
}

export default SSStyledSatText
