import { Colors } from '@/styles'
import { text, type TextFontSize, type TextFontWeight } from '@/styles/sizes'
import { formatNumber } from '@/utils/format'

import SSText from './SSText'

type SSStyledSatTextProps = {
  amount: number
  decimals?: number
  useZeroPadding?: boolean
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
  type = 'send',
  noColor = true,
  textSize = '3xl',
  weight = 'regular',
  letterSpacing = -0.1
}: SSStyledSatTextProps) {
  const formatted = formatNumber(amount, decimals, useZeroPadding)
  const spacedFormatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ')

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
      {spacedFormatted.split('').map((char, index) => {
        const isBeforeFirstNonZero = index < firstNonZeroIndex

        return (
          <SSText
            key={index}
            size={textSize}
            weight={weight}
            style={{
              letterSpacing,
              lineHeight: text.fontSize[textSize],
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
                    : Colors.mainGreen
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
