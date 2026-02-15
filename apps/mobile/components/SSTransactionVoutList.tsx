import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { TouchableOpacity } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import { SSDetailsListItem } from '@/components/SSDetailsList'
import SSScriptDecoded from '@/components/SSScriptDecoded'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type Transaction } from '@/types/models/Transaction'
import { setClipboard } from '@/utils/clipboard'
import { formatNumber } from '@/utils/format'
import { getUtxoOutpoint } from '@/utils/utxo'

import SSStyledSatText from './SSStyledSatText'

type SSTransactionVoutListProps = {
  txid?: Transaction['id']
  vout?: Transaction['vout']
  accountId?: string
}

export default function SSTransactionVoutList({
  txid,
  vout,
  accountId
}: SSTransactionVoutListProps) {
  const account = useAccountsStore((state) =>
    state.accounts.find((account) => accountId && account.id === accountId)
  )

  const [utxoDict, setUtxoDict] = useState<Record<string, boolean>>({})
  const addressDict: Record<string, boolean> = {}
  const [labelsDict, setLabelsDict] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!account) return

    const utxos: Record<string, boolean> = {}
    account.utxos.forEach((utxo) => (utxos[getUtxoOutpoint(utxo)] = true))
    account.addresses.forEach((addr) => (addressDict[addr.address] = true))
    setUtxoDict(utxos)

    if (!txid || !vout) return

    const labels: Record<number, string> = {}
    vout.forEach((output, index) => {
      const utxoOutpoint = `${txid}:${index}`
      const outputAddress = output.address
      const labelFromUtxo = account.labels[utxoOutpoint]
      const labelFromAddress = account.labels[outputAddress]
      const label = labelFromUtxo || labelFromAddress
      if (!label) return
      labels[index] = label.label
      utxos[utxoOutpoint] = true
    })
    setLabelsDict(labels)
    setUtxoDict(utxos)
  }, [account, txid, vout]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!txid || !vout) return null

  return (
    <SSVStack>
      {vout.map((output, index) => (
        <TouchableOpacity
          key={index}
          onPress={() => {
            if (utxoDict[`${txid}:${index}`]) {
              router.navigate(
                `/signer/bitcoin/account/${accountId}/transaction/${txid}/utxo/${index}`
              )
            }
          }}
        >
          <SSVStack key={`${txid}:${index}`}>
            <SSSeparator color="gradient" />
            <SSText weight="bold" center>
              {t('transaction.output.title')} {index}
            </SSText>
            <SSDetailsListItem
              header={t('transaction.value')}
              text={formatNumber(output.value, 0, false, ' ')}
              headerSize="sm"
              textSize="sm"
            />
            <TouchableOpacity
              onPress={() => {
                if (addressDict[output.address]) {
                  router.navigate(
                    `/signer/bitcoin/account/${accountId}/address/${output.address}`
                  )
                } else {
                  setClipboard(output.address)
                }
              }}
            >
              <SSVStack gap="sm">
                <SSText uppercase weight="bold">
                  {t('bitcoin.address')}
                </SSText>
                <SSAddressDisplay
                  address={output.address}
                  copyToClipboard={false}
                  variant="bare"
                  color="muted"
                  size="sm"
                />
              </SSVStack>
            </TouchableOpacity>
            {labelsDict[index] && (
              <SSVStack gap="none">
                <SSText uppercase weight="bold" size="md">
                  {t('common.label')}
                </SSText>
                <SSText color="muted" size="md">
                  {labelsDict[index]}
                </SSText>
              </SSVStack>
            )}
            <SSVStack>
              <SSText uppercase weight="bold" size="sm">
                {t('transaction.unlockingScript')}
              </SSText>
              <SSScriptDecoded script={output.script || []} />
            </SSVStack>
          </SSVStack>
        </TouchableOpacity>
      ))}
    </SSVStack>
  )
}
