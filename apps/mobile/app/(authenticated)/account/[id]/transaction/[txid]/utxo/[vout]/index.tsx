import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'

import SSClipboardCopy from '@/components/SSClipboardCopy'
import { SSLabelDetails } from '@/components/SSLabelDetails'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import type { UtxoSearchParams } from '@/types/navigation/searchParams'
import { formatDate, formatNumber } from '@/utils/format'

export default function UtxoDetails() {
  const { id: accountId, txid, vout } = useLocalSearchParams<UtxoSearchParams>()

  const [tx, utxo] = useAccountsStore((state) => [
    state.accounts
      .find((account) => account.name === accountId)
      ?.transactions.find((tx) => tx.id === txid),
    state.accounts
      .find((account) => account.name === accountId)
      ?.utxos.find((u) => u.txid === txid && u.vout === Number(vout))
  ])

  const placeholder = '-'
  const [blockTime, setBlockTime] = useState(placeholder)
  const [blockHeight, setBlockHeight] = useState(placeholder)
  const [amount, setAmount] = useState(placeholder)
  const [utxoAddress, setUtxoAddress] = useState(placeholder)

  const updateInfo = () => {
    if (tx) {
      const { blockHeight, timestamp } = tx
      if (blockHeight) setBlockHeight(blockHeight.toString())
      if (timestamp) setBlockTime(formatDate(timestamp))
    }

    if (utxo) {
      const { addressTo, value } = utxo
      if (value) setAmount(formatNumber(value))
      if (addressTo) setUtxoAddress(addressTo)
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
          headerTitle: () => <SSText>{i18n.t('utxoDetails.labelEdit')}</SSText>
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
          <SSText center size="lg">
            {i18n.t('utxoDetails.title')}
          </SSText>
          <SSSeparator color="gradient" />
          <SSLabelDetails
            label={utxo?.label || ''}
            link={`/account/${accountId}/transaction/${txid}/utxo/${vout}/label`}
            header={i18n.t('utxoDetails.label')}
          />
        </SSVStack>
        <SSVStack>
          <SSSeparator color="gradient" />
          <SSHStack justifyBetween>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.date')}
              </SSText>
              <SSText color="muted" uppercase>
                {blockTime}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.block')}
              </SSText>
              <SSText color="muted" uppercase>
                {blockHeight}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.amount')}
              </SSText>
              <SSClipboardCopy text={amount}>
                <SSText color="muted" uppercase>
                  {amount}{' '}
                  {amount !== placeholder ? i18n.t('bitcoin.sats') : ''}
                </SSText>
              </SSClipboardCopy>
            </SSVStack>
          </SSHStack>
          <SSSeparator color="gradient" />
          <SSClipboardCopy text={utxoAddress}>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.address')}
              </SSText>
              <SSText color="muted">{utxoAddress}</SSText>
            </SSVStack>
          </SSClipboardCopy>
          <SSSeparator color="gradient" />
          <SSClipboardCopy text={txid || ''}>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.transaction')}
              </SSText>
              <SSText color="muted">{txid}</SSText>
            </SSVStack>
          </SSClipboardCopy>
          <SSSeparator color="gradient" />
          <SSClipboardCopy text={vout || ''}>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.outputIndex')}
              </SSText>
              <SSText color="muted">{vout}</SSText>
            </SSVStack>
          </SSClipboardCopy>
        </SSVStack>
      </SSVStack>
    </ScrollView>
  )
}
