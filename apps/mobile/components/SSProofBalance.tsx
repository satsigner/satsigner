import { type StyleProp, StyleSheet, type ViewStyle } from 'react-native'

import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { formatFiatPrice, formatNumber } from '@/utils/format'

type SSProofBalanceProps = {
  balance: number
  fiatCurrency: string
  btcPrice: number
  useZeroPadding: boolean
  style?: StyleProp<ViewStyle>
}

function SSProofBalance({
  balance,
  fiatCurrency,
  btcPrice,
  useZeroPadding,
  style
}: SSProofBalanceProps) {
  return (
    <SSVStack style={[styles.container, style]}>
      <SSText color="muted" uppercase>
        {t('ecash.mint.balance')}
      </SSText>
      <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
        <SSText size="lg" weight="medium">
          {formatNumber(balance, 0, useZeroPadding)} sats
        </SSText>
      </SSHStack>
      {btcPrice > 0 && (
        <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
          <SSText color="muted">{formatFiatPrice(balance, btcPrice)}</SSText>
          <SSText size="xs" style={{ color: Colors.gray[500] }}>
            {fiatCurrency}
          </SSText>
        </SSHStack>
      )}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16
  }
})

export default SSProofBalance
