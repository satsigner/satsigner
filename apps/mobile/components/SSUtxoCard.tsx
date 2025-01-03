import { useRoute } from '@react-navigation/native'
import { useRouter } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { usePriceStore } from '@/store/price'
import { Colors } from '@/styles'
import { type Utxo } from '@/types/models/Utxo'
import { formatAddress, formatNumber } from '@/utils/format'

import { SSIconEdit } from './icons'
import SSIconButton from './SSIconButton'
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
  const route = useRoute()

  const id = (route.params as any).id as number
  const { txid, vout } = utxo

  return (
    <SSHStack
      justifyBetween
      style={{ paddingTop: 8, flex: 1, alignItems: 'stretch' }}
    >
      <SSVStack>
        <SSIconButton
          onPress={() =>
            router.push({
              pathname: '/account/[id]/transaction/[txid]/utxo/[vout]',
              params: { id, txid, vout }
            } as any)
          }
        >
          <SSIconEdit height={24} width={24} />
        </SSIconButton>
      </SSVStack>
      <SSVStack gap="xs">
        <SSText color="muted">
          {utxo.timestamp && <SSTimeAgoText date={new Date(utxo.timestamp)} />}
        </SSText>
        <SSHStack gap="xxs" style={{ alignItems: 'baseline' }}>
          <SSText size="3xl">{formatNumber(utxo.value)}</SSText>
          <SSText color="muted">{i18n.t('bitcoin.sats').toLowerCase()}</SSText>
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
          {utxo.label || i18n.t('account.noLabel')}
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
  )
}
