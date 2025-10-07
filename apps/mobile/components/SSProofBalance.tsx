import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSText from '@/components/SSText'
import { useEcash } from '@/hooks/useEcash'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { formatFiatPrice, formatNumber } from '@/utils/format'

type SSProofBalanceProps = {
  mintUrl?: string
  style?: any
}

export default function SSProofBalance({ style }: SSProofBalanceProps) {
  const { proofs } = useEcash()
  const useZeroPadding = useSettingsStore((state) => state.useZeroPadding)
  const [fiatCurrency, btcPrice, fetchPrices] = usePriceStore(
    useShallow((state) => [
      state.fiatCurrency,
      state.btcPrice,
      state.fetchPrices
    ])
  )
  const mempoolUrl = useBlockchainStore(
    (state) => state.configsMempool['bitcoin']
  )

  // Fetch prices on mount and when currency changes
  useEffect(() => {
    fetchPrices(mempoolUrl)
  }, [fetchPrices, fiatCurrency, mempoolUrl])

  const balance = proofs.reduce((sum, proof) => {
    // TODO: Implement proper mint-specific proof filtering
    // For now, assume all proofs belong to the current mint
    return sum + proof.amount
  }, 0)

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
