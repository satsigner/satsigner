import { type ComponentProps } from 'react'
import { type StyleProp, type TextStyle } from 'react-native'

import { PRIVACY_MASK } from '@/constants/privacy'
import { t } from '@/locales'
import { text, type TextFontSize } from '@/styles/sizes'

import SSStyledSatText from './SSStyledSatText'
import SSText from './SSText'

type SSAmountDisplayProps = ComponentProps<typeof SSStyledSatText> & {
  privacyMode: boolean
  unitSize?: TextFontSize
  unitStyle?: StyleProp<TextStyle>
}

/**
 * Sats/BTC amount followed by its unit label, masked in privacy mode.
 * Renders a fragment: place it inside the caller's row so the row keeps its
 * own spacing and alignment.
 */
function SSAmountDisplay({
  privacyMode,
  textSize = '3xl',
  unitSize = 'sm',
  unitStyle,
  ...satTextProps
}: SSAmountDisplayProps) {
  const { currency, letterSpacing, weight } = satTextProps

  const maskStyle = { letterSpacing, lineHeight: text.fontSize[textSize] }

  return (
    <>
      {privacyMode ? (
        <SSText size={textSize} weight={weight} style={maskStyle}>
          {PRIVACY_MASK}
        </SSText>
      ) : (
        <SSStyledSatText textSize={textSize} {...satTextProps} />
      )}
      <SSText color="muted" size={unitSize} style={unitStyle}>
        {currency === 'btc' ? t('bitcoin.btc') : t('bitcoin.sats')}
      </SSText>
    </>
  )
}

export default SSAmountDisplay
