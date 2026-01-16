import { useLocalSearchParams, useRouter } from 'expo-router'
import { TouchableOpacity } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress, formatNumber } from '@/utils/format'
import { parseLabel } from '@/utils/parse'

import SSText from './SSText'
import SSStyledSatText from './SSStyledSatText'
import SSTimeAgoText from './SSTimeAgoText'

type SSUtxoCardProps = {
  utxo: Utxo
}

function SSUtxoCard({ utxo }: SSUtxoCardProps) {
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )
  const [currencyUnit, useZeroPadding] = useSettingsStore(
    useShallow((state) => [state.currencyUnit, state.useZeroPadding])
  )

  const router = useRouter()

  const { id } = useLocalSearchParams<AccountSearchParams>()
  const { txid, vout } = utxo

  return (
    <TouchableOpacity
      onPress={() =>
        router.navigate(
          `/signer/bitcoin/account/${id}/transaction/${txid}/utxo/${vout}`
        )
      } // TODO: Refactor to receive as prop
    >
      <SSHStack
        justifyBetween
        style={{ paddingTop: 8, flex: 1, alignItems: 'stretch' }}
      >
        <SSVStack gap="none" style={{}}>
          <SSHStack gap="xxs" style={{ alignItems: 'baseline' }}>
            <SSStyledSatText
              amount={utxo.value}
              decimals={0}
              useZeroPadding={useZeroPadding}
              currency={currencyUnit}
              textSize="3xl"
            />
            <SSText color="muted">
              {currencyUnit === 'btc'
                ? t('bitcoin.btc').toLowerCase()
                : t('bitcoin.sats').toLowerCase()}
            </SSText>
          </SSHStack>
          <SSHStack>
            <SSText>{formatNumber(satsToFiat(utxo.value), 2)}</SSText>
            <SSText style={{ color: Colors.gray[400] }}>{fiatCurrency}</SSText>
          </SSHStack>
        </SSVStack>
        <SSVStack gap="none" style={{ alignItems: 'flex-end' }}>
          <SSHStack>
            <SSText>
              {utxo.addressTo && formatAddress(utxo.addressTo || '')}
            </SSText>
          </SSHStack>
          <SSText color="muted">
            {utxo.timestamp && (
              <SSTimeAgoText date={new Date(utxo.timestamp)} />
            )}
          </SSText>
        </SSVStack>
      </SSHStack>
      <SSText size="md" color={utxo.label ? 'white' : 'muted'}>
        {parseLabel(utxo.label || t('utxo.noLabel'))['label']}
      </SSText>
    </TouchableOpacity>
  )
}

export default SSUtxoCard
