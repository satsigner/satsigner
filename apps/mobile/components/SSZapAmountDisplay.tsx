import { StyleSheet } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import { NOSTR_PRIVACY_MASK } from '@/constants/nostr'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { formatFiatPrice } from '@/utils/format'

type SSZapAmountDisplayProps = {
  amountSats: number
  incoming?: boolean
}

export default function SSZapAmountDisplay({
  amountSats,
  incoming
}: SSZapAmountDisplayProps) {
  const privacyMode = useSettingsStore((state) => state.privacyMode)
  const btcPrice = usePriceStore((state) => state.btcPrice)
  const fiatCurrency = usePriceStore((state) => state.fiatCurrency)

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
