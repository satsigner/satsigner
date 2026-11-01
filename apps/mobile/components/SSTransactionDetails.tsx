import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSSignatureRequiredDisplay from '@/components/SSSignatureRequiredDisplay'
import SSText from '@/components/SSText'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type Account } from '@/types/models/Account'
import { getAccountAddressSets } from '@/utils/address'
import { formatTxId } from '@/utils/format'
import {
  extractTransactionDataFromPSBTEnhanced,
  findMatchingAccount,
  type KeyFingerprintsByAccount,
  type TransactionData
} from '@/utils/psbt'
import { parsePsbtDetails } from '@/utils/psbtDetails'
import {
  buildKnownTxIds,
  buildOutpointLabelsByRef,
  buildSpendingTxIdsByOutpoint,
  buildTxLabelsById
} from '@/utils/sankeyInputLabel'
import { buildOwnedOutpoints } from '@/utils/sankeyInputOwnership'
import { legacyEstimateTransactionSize } from '@/utils/transaction'

type SSTransactionDetailsProps = {
  transactionData: TransactionData
  account: Account | undefined
  accounts: Account[]
  keyFingerprintsByAccount: KeyFingerprintsByAccount
  visibility?: { sankey: boolean; status: boolean }
  onToggleVisibility?: (component: 'sankey' | 'status') => void
  onGoToSignFlow?: () => void
  /** Called with the matched account id and a linked transaction id when a chart link is pressed. */
  onOpenLinkedTx?: (accountId: string, txId: string) => void
}

function extractTransactionData(originalPsbt: string, account: Account) {
  try {
    return extractTransactionDataFromPSBTEnhanced(originalPsbt, account)
  } catch {
    return null
  }
}

function SSTransactionDetails({
  transactionData,
  account,
  accounts,
  keyFingerprintsByAccount,
  visibility,
  onToggleVisibility,
  onGoToSignFlow,
  onOpenLinkedTx
}: SSTransactionDetailsProps) {
  const details = parsePsbtDetails(transactionData.combinedPsbt)
  const accountMatch = details
    ? findMatchingAccount(
        details.originalPsbt,
        accounts,
        keyFingerprintsByAccount
      )
    : null
  const matchedAccount = accountMatch?.account || account
  const { ownAddresses, internalAddresses } = getAccountAddressSets(
    matchedAccount?.addresses ?? []
  )
  const handleOpenLinkedTx =
    matchedAccount && onOpenLinkedTx
      ? (txId: string) => onOpenLinkedTx(matchedAccount.id, txId)
      : undefined
  const unspentOutpoints = new Set(
    matchedAccount?.utxos.map((utxo) => `${utxo.txid}:${utxo.vout}`)
  )
  const txLabelsById = buildTxLabelsById(matchedAccount?.transactions)
  const knownTxIds = buildKnownTxIds(matchedAccount?.transactions)
  const spendingTxIdsByOutpoint = buildSpendingTxIdsByOutpoint(
    matchedAccount?.transactions
  )
  const outpointLabelsByRef = buildOutpointLabelsByRef(matchedAccount ?? {})
  const ownedOutpoints = buildOwnedOutpoints({
    addresses: matchedAccount?.addresses,
    transactions: matchedAccount?.transactions,
    utxos: matchedAccount?.utxos
  })

  if (!details) {
    return (
      <SSText size="sm" color="muted">
        {t('account.nostrSync.devicesGroupChat.invalidPsbt')}
      </SSText>
    )
  }

  const { collectedSignatures, keyCount, keysRequired, originalPsbt, txid } =
    details
  const isMultisig = keyCount > 1
  const extractedData = matchedAccount
    ? extractTransactionData(originalPsbt, matchedAccount)
    : null

  const finalInputs = extractedData?.inputs || []
  const finalOutputs = extractedData?.outputs || []

  const { size, vsize } = legacyEstimateTransactionSize(
    finalInputs.length,
    finalOutputs.length
  )
  const vin = finalInputs.map((input) => ({
    label: input.label || '',
    previousOutput: { txid: input.txid, vout: input.vout },
    value: input.value
  }))
  const vout = finalOutputs.map((output) => ({
    address: output.address,
    label: output.label || '',
    value: output.value
  }))
  const transaction = {
    id: txid,
    size,
    vin,
    vout,
    vsize
  }

  const textSize = onToggleVisibility ? 'lg' : 'md'

  return (
    <SSVStack
      gap={onToggleVisibility ? 'md' : undefined}
      style={onToggleVisibility && { paddingTop: 10 }}
    >
      <SSHStack justifyBetween style={{ alignItems: 'center' }}>
        <SSText size={textSize} weight="bold">
          {t('account.transaction.signRequest')}
        </SSText>
        <SSText
          size={onToggleVisibility ? 'xs' : textSize}
          type="mono"
          color="muted"
        >
          {formatTxId(txid)}
        </SSText>
      </SSHStack>
      {onToggleVisibility ? (
        <>
          {visibility?.sankey ? (
            <View style={styles.chatChartContainer}>
              <SSTransactionChart
                transaction={transaction}
                ownAddresses={ownAddresses}
                internalAddresses={internalAddresses}
                unspentOutpoints={unspentOutpoints}
                ownedOutpoints={ownedOutpoints}
                txLabelsById={txLabelsById}
                knownTxIds={knownTxIds}
                spendingTxIdsByOutpoint={spendingTxIdsByOutpoint}
                outpointLabelsByRef={outpointLabelsByRef}
                scale={0.75}
                onOpenLinkedTx={handleOpenLinkedTx}
              />
            </View>
          ) : (
            <SSButton
              label={t('transaction.loadSankey')}
              onPress={() => onToggleVisibility('sankey')}
            />
          )}

          {isMultisig &&
            (visibility?.status ? (
              <SSSignatureRequiredDisplay
                requiredNumber={keysRequired}
                totalNumber={keyCount}
                collectedSignatures={collectedSignatures}
              />
            ) : (
              <SSButton
                label={t('transaction.checkStatus')}
                onPress={() => onToggleVisibility('status')}
              />
            ))}
        </>
      ) : (
        <>
          <View style={styles.chartContainer}>
            <SSTransactionChart
              transaction={transaction}
              ownAddresses={ownAddresses}
              internalAddresses={internalAddresses}
              unspentOutpoints={unspentOutpoints}
              ownedOutpoints={ownedOutpoints}
              txLabelsById={txLabelsById}
              knownTxIds={knownTxIds}
              outpointLabelsByRef={outpointLabelsByRef}
              onOpenLinkedTx={handleOpenLinkedTx}
            />
          </View>
          {isMultisig && (
            <View style={styles.signatureContainer}>
              <SSSignatureRequiredDisplay
                requiredNumber={keysRequired}
                totalNumber={keyCount}
                collectedSignatures={collectedSignatures}
              />
            </View>
          )}
        </>
      )}
      {onGoToSignFlow && (
        <SSButton
          label={t('account.transaction.signFlow')}
          variant="secondary"
          style={styles.signFlowButton}
          onPress={onGoToSignFlow}
        />
      )}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  chartContainer: {
    overflow: 'hidden',
    paddingLeft: 8,
    paddingRight: 16,
    width: '100%'
  },
  chatChartContainer: {
    alignItems: 'center',
    backgroundColor: '#151515',
    borderRadius: 8,
    marginTop: 2,
    padding: 8,
    paddingLeft: 46
  },
  signFlowButton: {
    alignSelf: 'flex-start',
    marginTop: 8
  },
  signatureContainer: {
    alignItems: 'center'
  }
})

export default SSTransactionDetails
