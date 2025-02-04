import { Colors } from '@/styles'
import { formatNumber } from '@/utils/format'

import SSText from './SSText'

type SSStyledSatTextProps = {
  amount: number
  decimals?: number
  padding?: boolean
  type?: 'send' | 'receive'
  noColor?: boolean
  letterSpacing?: number
  weight?: 'ultralight' | 'light' | 'regular' | 'medium' | 'bold'
  textSize?:
    | '3xl'
    | 'xxs'
    | 'xs'
    | 'sm'
    | 'md'
    | 'lg'
    | 'xl'
    | '2xl'
    | '4xl'
    | '5xl'
    | '6xl'
    | '7xl'
}

export default function SSStyledSatText({
  amount,
  decimals = 0,
  padding = false,
  type = 'send',
  noColor = true,
  textSize = '3xl',
  weight = 'regular',
  letterSpacing = -0.5
}: SSStyledSatTextProps) {
  const formatted = formatNumber(amount, decimals, padding)
  const spacedFormatted = formatted.replace(
    /(\d)(?=(\d{3})+(?!\d))/g,
    '$1\u2001'
  )

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
