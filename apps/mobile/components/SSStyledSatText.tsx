import React from 'react'
import SSText from './SSText'
import { Colors } from '@/styles'
import { formatNumber } from '@/utils/format'

const SSStyledSatText: React.FC<{
  amount: number
  decimals?: number
  padding?: boolean
  type?: 'send' | 'receive'
  noColor?: boolean
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
}> = ({
  amount,
  decimals = 0,
  padding = false,
  type = 'send',
  noColor = true,
  textSize = '3xl'
}) => {
  const formatted = formatNumber(amount, decimals, padding)
  const spacedFormatted = formatted.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1 ')

  let firstNonZeroIndex = spacedFormatted.search(/[1-9]/)
  if (firstNonZeroIndex === -1) firstNonZeroIndex = spacedFormatted.length

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
