import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSLabelDetails from '@/components/SSLabelDetails'
import SSScriptDecoded from '@/components/SSScriptDecoded'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type UtxoSearchParams } from '@/types/navigation/searchParams'
import { formatDate, formatNumber } from '@/utils/format'

export default function UtxoDetails() {
  const { id: accountId, txid, vout } = useLocalSearchParams<UtxoSearchParams>()

  const [tx, utxo] = useAccountsStore((state) => [
    state.accounts
      .find((account) => account.id === accountId)
      ?.transactions.find((tx) => tx.id === txid),
    state.accounts
      .find((account) => account.id === accountId)
      ?.utxos.find((u) => u.txid === txid && u.vout === Number(vout))
  ])

  const placeholder = '-'
  const [blockTime, setBlockTime] = useState(placeholder)
  const [blockHeight, setBlockHeight] = useState(placeholder)
  const [amount, setAmount] = useState(placeholder)

  const updateInfo = () => {
    if (tx) {
      const { blockHeight, timestamp } = tx
      if (blockHeight) setBlockHeight(blockHeight.toString())
      if (timestamp) setBlockTime(formatDate(timestamp))
    }

    if (utxo) {
      const { value } = utxo
      if (value) setAmount(formatNumber(value))
    }
  }

  useEffect(() => {
    try {
      updateInfo()
    } catch {
      router.back()
    }
  }, [tx, utxo]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>{t('utxo.details.title')}</SSText>
        }}
      />
      <SSVStack
        gap="lg"
        style={{
          flexGrow: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 20
        }}
      >
        <SSVStack>
          <SSLabelDetails
            label={utxo?.label || ''}
            link={`/account/${accountId}/transaction/${txid}/utxo/${vout}/label`}
            header={t('utxo.label')}
          />
        </SSVStack>
        <SSVStack>
          <SSSeparator color="gradient" />
          <SSHStack justifyBetween>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {t('common.date')}
              </SSText>
              <SSText color="muted" uppercase>
                {blockTime}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {t('bitcoin.block')}
              </SSText>
              <SSText color="muted" uppercase>
                {blockHeight}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {t('common.amount')}
              </SSText>
              <SSClipboardCopy text={amount}>
                <SSText color="muted" uppercase>
                  {amount} {amount !== placeholder ? t('bitcoin.sats') : ''}
                </SSText>
              </SSClipboardCopy>
            </SSVStack>
          </SSHStack>
          <SSSeparator color="gradient" />
          <TouchableOpacity
            onPress={() => {
              if (utxo?.addressTo) {
                router.navigate(
                  `/account/${accountId}/address/${utxo.addressTo}`
                )
              }
            }}
          >
            <SSVStack gap="sm">
              <SSText weight="bold" uppercase>
                {t('utxo.address')}
              </SSText>
              <SSAddressDisplay address={utxo?.addressTo || '-'} />
            </SSVStack>
          </TouchableOpacity>
          <SSSeparator color="gradient" />
          <TouchableOpacity
            onPress={() =>
              router.navigate(`/account/${accountId}/transaction/${txid}`)
            }
          >
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {t('transaction.id')}
              </SSText>
              <SSText color="muted">{txid}</SSText>
            </SSVStack>
          </TouchableOpacity>
          <SSSeparator color="gradient" />
          <SSClipboardCopy text={vout || ''}>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {t('utxo.outputIndex')}
              </SSText>
              <SSText color="muted">{vout}</SSText>
            </SSVStack>
          </SSClipboardCopy>
          <SSSeparator color="gradient" />
          <SSVStack>
            <SSText uppercase weight="bold">
              {t('utxo.unlockingScript')}
            </SSText>
            <SSScriptDecoded script={utxo?.script || []} />
          </SSVStack>
        </SSVStack>
      </SSVStack>
    </ScrollView>
  )
}
