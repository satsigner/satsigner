import { useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { toggleUtxoExcluded } from '@/utils/excludeUtxo'
import { formatAddress, formatNumber } from '@/utils/format'
import { normalizeUtxoLabelForDisplay } from '@/utils/parse'
import { utxoAmountTextSize } from '@/utils/utxoAmountTextSize'

import { SSIconExclude } from './icons'
import SSIconButton from './SSIconButton'
import SSStyledSatText from './SSStyledSatText'
import SSText from './SSText'
import SSTimeAgoText from './SSTimeAgoText'
import SSUtxoBar from './SSUtxoBar'

type SSUtxoCardProps = {
  utxo: Utxo
  totalBalance?: number
  addressIndex?: number
  excluded?: boolean
}

function SSUtxoCard({
  utxo,
  totalBalance,
  addressIndex,
  excluded = false
}: SSUtxoCardProps) {
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )
  const [currencyUnit, useZeroPadding] = useSettingsStore(
    useShallow((state) => [state.currencyUnit, state.useZeroPadding])
  )

  const router = useRouter()

  const { id } = useLocalSearchParams<AccountSearchParams>()
  const { txid, vout } = utxo

  function handleToggleExcluded() {
    if (!id) {
      return
    }
    toggleUtxoExcluded(id, utxo)
  }

  const amountTextSize = utxoAmountTextSize(utxo.value)
  const displayLabel = normalizeUtxoLabelForDisplay(utxo.label || '')

  return (
    <View>
      {totalBalance !== undefined && totalBalance > 0 && (
        <SSUtxoBar utxoValue={utxo.value} totalBalance={totalBalance} />
      )}
      <SSHStack style={{ alignItems: 'stretch' }}>
        <TouchableOpacity
          style={styles.body}
          onPress={() =>
            router.navigate(
              `/signer/bitcoin/account/${id}/transaction/${txid}/utxo/${vout}`
            )
          }
          onLongPress={handleToggleExcluded}
        >
          <SSVStack
            gap="none"
            style={[styles.content, excluded && styles.contentExcluded]}
          >
            <SSHStack justifyBetween>
              <SSVStack gap="none">
                <SSHStack gap="xxs" style={{ alignItems: 'baseline' }}>
                  <SSStyledSatText
                    amount={utxo.value}
                    decimals={0}
                    useZeroPadding={useZeroPadding}
                    currency={currencyUnit}
                    textSize={amountTextSize}
                  />
                  <SSText
                    size={amountTextSize === '3xl' ? 'md' : 'sm'}
                    color="muted"
                  >
                    {currencyUnit === 'btc'
                      ? t('bitcoin.btc').toLowerCase()
                      : t('bitcoin.sats').toLowerCase()}
                  </SSText>
                </SSHStack>
                <SSHStack>
                  <SSText>{formatNumber(satsToFiat(utxo.value), 2)}</SSText>
                  <SSText style={{ color: Colors.gray[400] }}>
                    {fiatCurrency}
                  </SSText>
                </SSHStack>
              </SSVStack>
              <SSVStack gap="none" style={styles.meta}>
                <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                  <SSText>
                    {utxo.addressTo && formatAddress(utxo.addressTo || '')}
                  </SSText>
                  {typeof addressIndex === 'number' && (
                    <SSText color="muted" size="sm">
                      ({addressIndex})
                    </SSText>
                  )}
                </SSHStack>
                <SSText color="muted">
                  {utxo.timestamp && (
                    <SSTimeAgoText date={new Date(utxo.timestamp)} />
                  )}
                </SSText>
              </SSVStack>
            </SSHStack>
            <SSText size="md" color={displayLabel ? 'white' : 'muted'}>
              {displayLabel || t('utxo.noLabel')}
            </SSText>
          </SSVStack>
        </TouchableOpacity>
        <SSIconButton
          onPress={handleToggleExcluded}
          style={styles.excludeButton}
        >
          <SSIconExclude
            height={16}
            width={16}
            stroke={excluded ? Colors.mainRed : Colors.gray[500]}
          />
        </SSIconButton>
      </SSHStack>
    </View>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1
  },
  content: {
    alignItems: 'stretch',
    flex: 1,
    paddingTop: 8
  },
  contentExcluded: {
    opacity: 0.45
  },
  excludeButton: {
    justifyContent: 'center',
    paddingLeft: 8
  },
  meta: {
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    flexShrink: 0
  }
})

export default SSUtxoCard
