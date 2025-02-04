import { useLocalSearchParams, useRouter } from 'expo-router'
import { TouchableOpacity } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress, formatLabel, formatNumber } from '@/utils/format'

import { SSIconInfo } from './icons'
import SSText from './SSText'
import SSTimeAgoText from './SSTimeAgoText'

type SSUtxoCardProps = {
  utxo: Utxo
}

export default function SSUtxoCard({ utxo }: SSUtxoCardProps) {
  const [fiatCurrency, satsToFiat] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.satsToFiat])
  )
  const useZeroPadding = useSettingsStore(
    useShallow((state) => state.useZeroPadding)
  )

  const router = useRouter()

  const { id } = useLocalSearchParams<AccountSearchParams>()
  const { txid, vout } = utxo

  return (
    <TouchableOpacity
      onPress={() =>
        router.navigate(`/account/${id}/transaction/${txid}/utxo/${vout}`)
      } // TODO: Refactor to receive as prop
    >
      <SSHStack
        justifyBetween
        style={{ paddingTop: 8, flex: 1, alignItems: 'stretch' }}
      >
        <SSVStack gap="none" style={{}}>
          <SSHStack gap="xxs" style={{ alignItems: 'baseline' }}>
            <SSText size="3xl" style={{ lineHeight: 30 }}>
              {formatNumber(utxo.value, 0, useZeroPadding)}
            </SSText>
            <SSText color="muted">
              {i18n.t('bitcoin.sats').toLowerCase()}
            </SSText>
          </SSHStack>
          <SSHStack>
            <SSText>{formatNumber(satsToFiat(utxo.value), 2)}</SSText>
            <SSText style={{ color: Colors.gray[400] }}>{fiatCurrency}</SSText>
          </SSHStack>
          <SSText size="md" color={utxo.label ? 'white' : 'muted'}>
            {i18n.t('common.memo')} {': '}
            {formatLabel(utxo.label || i18n.t('account.noLabel'))['label']}
          </SSText>
        </SSVStack>
        <SSVStack gap="none">
          <SSHStack>
            <SSText>
              {utxo.addressTo && formatAddress(utxo.addressTo || '')}
            </SSText>
            <SSIconInfo height={16} width={16} />
          </SSHStack>
          <SSText color="muted">
            {utxo.timestamp && (
              <SSTimeAgoText date={new Date(utxo.timestamp)} />
            )}
          </SSText>
        </SSVStack>
      </SSHStack>
    </TouchableOpacity>
  )
}
