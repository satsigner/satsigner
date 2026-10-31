import { StyleSheet } from 'react-native'

import SSText from '@/components/SSText'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import { Colors } from '@/styles'
import type { DisplayPreferences } from '@/types/ui/displayPreferences'
import { formatFiatPrice } from '@/utils/format'

type SSZapAmountDisplayProps = Pick<
  DisplayPreferences,
  'btcPrice' | 'fiatCurrency' | 'privacyMode'
> & {
  amountSats: number
  incoming?: boolean
}

export default function SSZapAmountDisplay({
  amountSats,
  incoming,
  btcPrice,
  fiatCurrency,
  privacyMode
}: SSZapAmountDisplayProps) {
  if (privacyMode) {
    return (
      <SSText size="sm" weight="medium">
        {NOSTR_PRIVACY_MASK} sats
      </SSText>
    )
  }

  return (
    <SSHStack gap="xs" style={styles.row}>
      <SSText
        size="sm"
        weight="medium"
        style={incoming ? styles.incoming : undefined}
      >
        {amountSats.toLocaleString()}
      </SSText>
      <SSText size="xxs" color="muted">
        sats
      </SSText>
      {btcPrice > 0 && (
        <>
          <SSText size="xxs" color="muted">
            ·
          </SSText>
          <SSText size="xxs" color="muted">
            {formatFiatPrice(amountSats, btcPrice)} {fiatCurrency}
          </SSText>
        </>
      )}
    </SSHStack>
  )
}

const styles = StyleSheet.create({
  incoming: {
    color: Colors.success
  },
  row: {
    alignItems: 'baseline',
    flexWrap: 'wrap'
  }
})
