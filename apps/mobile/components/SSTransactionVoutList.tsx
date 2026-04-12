import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { TouchableOpacity } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSScriptDecoded from '@/components/SSScriptDecoded'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type Transaction } from '@/types/models/Transaction'
import { SAFE_LIMIT_OF_INPUTS_OUTPUTS } from '@/types/ui/sankey'
import { setClipboard } from '@/utils/clipboard'
import { formatNumber } from '@/utils/format'
import { getUtxoOutpoint } from '@/utils/utxo'

import { withPerformanceWarning } from './SSPerformanceWarning'

type SSTransactionVoutListProps = {
  txid?: Transaction['id']
  vout?: Transaction['vout']
  accountId?: string
}

export function SSTransactionVoutList({
  txid,
  vout,
  accountId
}: SSTransactionVoutListProps) {
  const account = useAccountsStore((state) =>
    state.accounts.find((account) => accountId && account.id === accountId)
  )

  const [utxoDict, setUtxoDict] = useState<Record<string, boolean>>({})
  const addressDict: Record<string, boolean> = account
    ? Object.fromEntries(account.addresses.map((addr) => [addr.address, true]))
    : {}
  const [labelsDict, setLabelsDict] = useState<Record<number, string>>({})

  useEffect(() => {
    if (!account) {
      return
    }

    const utxos: Record<string, boolean> = {}
    for (const utxo of account.utxos) {
      utxos[getUtxoOutpoint(utxo)] = true
    }
    setUtxoDict(utxos)

    if (!txid || !vout) {
      return
    }

    const labels: Record<number, string> = {}
    for (const [index, output] of vout.entries()) {
      const utxoOutpoint = `${txid}:${index}`
      const outputAddress = output.address
      const labelFromUtxo = account.labels[utxoOutpoint]
      const labelFromAddress = account.labels[outputAddress]
      const label = labelFromUtxo || labelFromAddress
      if (!label) {
        continue
      }
      labels[index] = label.label
      utxos[utxoOutpoint] = true
    }
    setLabelsDict(labels)
    setUtxoDict(utxos)
  }, [account, txid, vout]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!txid || !vout) {
    return null
  }

  return (
    <SSVStack>
      {vout.map((output, index) => (
        <TouchableOpacity
          key={`${txid}:${index}`}
          onPress={() => {
            if (utxoDict[`${txid}:${index}`]) {
              router.navigate(
                `/signer/bitcoin/account/${accountId}/transaction/${txid}/utxo/${index}`
              )
            }
          }}
        >
          <SSVStack style={{ paddingTop: 50 }}>
            <SSSeparator color="gradient" />
            <SSText size="lg">
              {t('transaction.output.title')} {index}
            </SSText>
            <SSVStack gap="none">
              <SSText color="muted">{t('transaction.value')}</SSText>
              <SSText size="lg">
                {formatNumber(output.value, 0, false, ' ')}
              </SSText>
            </SSVStack>
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
              <SSVStack gap="none">
                <SSText color="muted">{t('bitcoin.address')}</SSText>
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
                <SSText color="muted">{t('common.label')}</SSText>
                <SSText size="lg">{labelsDict[index]}</SSText>
              </SSVStack>
            )}
            <SSVStack>
              <SSText color="muted">{t('transaction.unlockingScript')}</SSText>
              <SSScriptDecoded script={output.script || []} />
            </SSVStack>
          </SSVStack>
        </TouchableOpacity>
      ))}
    </SSVStack>
  )
}

const thresholdCheck = ({ vout }: SSTransactionVoutListProps) =>
  vout !== undefined && vout.length > SAFE_LIMIT_OF_INPUTS_OUTPUTS

export default withPerformanceWarning<SSTransactionVoutListProps>(
  SSTransactionVoutList,
  thresholdCheck,
  'Too many outputs.\nDisplaying it may freeze the app.'
)
