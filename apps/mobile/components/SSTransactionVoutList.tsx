import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSScriptDecoded from '@/components/SSScriptDecoded'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import { SAFE_LIMIT_OF_INPUTS_OUTPUTS } from '@/constants/sankey'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import { setClipboard } from '@/utils/clipboard'
import { formatNumber } from '@/utils/format'
import { classifySpecialOutput, specialOutputTag } from '@/utils/specialOutput'
import { getUtxoOutpoint } from '@/utils/utxo'

import { withPerformanceWarning } from './SSPerformanceWarning'
import SSPressable from './SSPressable'

type SSTransactionVoutListProps = {
  txid?: Transaction['id']
  vout?: Transaction['vout']
  accountId?: string
  /** Called with the output index when a known UTXO output is pressed. */
  onOpenUtxo?: (index: number) => void
  /** Called with the address when a known account address is pressed. */
  onOpenAddress?: (address: string) => void
}

function getOutputLookups(
  account: Account | undefined,
  txid: SSTransactionVoutListProps['txid'],
  vout: SSTransactionVoutListProps['vout']
) {
  const utxoDict: Record<string, boolean> = {}
  const labelsDict: Record<number, string> = {}

  if (!account) {
    return { labelsDict, utxoDict }
  }

  for (const utxo of account.utxos) {
    utxoDict[getUtxoOutpoint(utxo)] = true
  }

  if (!txid || !vout) {
    return { labelsDict, utxoDict }
  }

  for (const [index, output] of vout.entries()) {
    const utxoOutpoint = `${txid}:${index}`
    const outputAddress = output.address
    const labelFromUtxo = account.labels[utxoOutpoint]
    const labelFromAddress = account.labels[outputAddress]
    const label = labelFromUtxo || labelFromAddress
    if (!label) {
      continue
    }
    labelsDict[index] = label.label
    utxoDict[utxoOutpoint] = true
  }

  return { labelsDict, utxoDict }
}

function SSTransactionVoutList({
  txid,
  vout,
  accountId,
  onOpenUtxo,
  onOpenAddress
}: SSTransactionVoutListProps) {
  const account = useAccountsStore((state) =>
    state.accounts.find((account) => accountId && account.id === accountId)
  )

  const addressDict: Record<string, boolean> = account
    ? Object.fromEntries(account.addresses.map((addr) => [addr.address, true]))
    : {}
  const { utxoDict, labelsDict } = getOutputLookups(account, txid, vout)

  if (!txid || !vout) {
    return null
  }

  return (
    <SSVStack>
      {vout.map((output, index) => {
        const specialTag = specialOutputTag(
          classifySpecialOutput(output.script)
        )

        return (
          <SSPressable
            key={`${txid}:${index}`}
            onPress={() => {
              if (utxoDict[`${txid}:${index}`]) {
                onOpenUtxo?.(index)
              }
            }}
          >
            <SSVStack style={{ paddingTop: 50 }}>
              <SSSeparator color="gradient" />
              <SSText size="lg">
                {t('transaction.output.title')} {index}
              </SSText>
              {specialTag ? (
                <SSVStack gap="none">
                  <SSText color="muted">{t('common.type')}</SSText>
                  <SSText size="lg">{specialTag}</SSText>
                </SSVStack>
              ) : null}
              <SSVStack gap="none">
                <SSText color="muted">{t('transaction.value')}</SSText>
                <SSText size="lg">
                  {formatNumber(output.value, 0, false, ' ')}
                </SSText>
              </SSVStack>
              {output.address ? (
                <SSPressable
                  onPress={() => {
                    if (addressDict[output.address]) {
                      onOpenAddress?.(output.address)
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
                </SSPressable>
              ) : null}
              {labelsDict[index] ? (
                <SSVStack gap="none">
                  <SSText color="muted">{t('common.label')}</SSText>
                  <SSText size="lg">{labelsDict[index]}</SSText>
                </SSVStack>
              ) : null}
              <SSVStack>
                <SSText color="muted">
                  {t('transaction.unlockingScript')}
                </SSText>
                <SSScriptDecoded script={output.script || []} />
              </SSVStack>
            </SSVStack>
          </SSPressable>
        )
      })}
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
