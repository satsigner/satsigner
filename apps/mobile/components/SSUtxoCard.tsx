import { useLocalSearchParams, useRouter } from 'expo-router'
import { TouchableOpacity } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress, formatLabel, formatNumber } from '@/utils/format'

import SSText from './SSText'
import SSTimeAgoText from './SSTimeAgoText'

type SSUtxoCardProps = {
  utxo: Utxo
}

export default function SSUtxoCard({ utxo }: SSUtxoCardProps) {
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )

  const router = useRouter()

  const { id } = useLocalSearchParams<AccountSearchParams>()
  const { txid, vout } = utxo

  return (
    <TouchableOpacity
      onPress={() =>
        router.navigate(`/account/${id}/transaction/${txid}/utxo/${vout}`)
      }
    >
      <SSHStack
        justifyBetween
        style={{ paddingTop: 8, flex: 1, alignItems: 'stretch' }}
      >
        <SSVStack gap="xs">
          <SSText color="muted">
            {utxo.timestamp && (
              <SSTimeAgoText date={new Date(utxo.timestamp)} />
            )}
          </SSText>
          <SSHStack gap="xxs" style={{ alignItems: 'baseline' }}>
            <SSText size="3xl">{formatNumber(utxo.value)}</SSText>
            <SSText color="muted">
              {i18n.t('bitcoin.sats').toLowerCase()}
            </SSText>
          </SSHStack>
          <SSText style={{ color: Colors.gray[400] }}>
            {formatNumber(satsToFiat(utxo.value), 2)} {fiatCurrency}
          </SSText>
        </SSVStack>
        <SSVStack justifyBetween>
          <SSText
            size="md"
            style={{ textAlign: 'right', color: Colors.gray[100] }}
          >
            {formatLabel(utxo.label || i18n.t('account.noLabel'))['label']}
          </SSText>
          <SSHStack gap="xs" style={{ alignSelf: 'flex-end' }}>
            <SSText color="muted">
              {utxo.addressTo && i18n.t('common.address').toLowerCase()}
            </SSText>
            <SSText>
              {utxo.addressTo && formatAddress(utxo.addressTo || '')}
            </SSText>
          </SSHStack>
        </SSVStack>
      </SSHStack>
    </TouchableOpacity>
  )
}
