import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSSignatureRequiredDisplay from '@/components/SSSignatureRequiredDisplay'
import SSText from '@/components/SSText'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type Account } from '@/types/models/Account'
import { type Transaction } from '@/types/models/Transaction'
import {
  type AccountMatchResult,
  extractIndividualSignedPsbts,
  extractOriginalPsbt,
  extractTransactionDataFromPSBTEnhanced,
  extractTransactionIdFromPSBT,
  findMatchingAccount,
  getMultisigInfoFromPsbt,
  type TransactionData
} from '@/utils/psbt'
import { legacyEstimateTransactionSize } from '@/utils/transaction'

type SSTransactionDetailsProps = {
  transactionData: TransactionData
  account: Account | undefined
  accounts: Account[]
  visibility?: { sankey: boolean; status: boolean }
  onToggleVisibility?: (component: 'sankey' | 'status') => void
  onGoToSignFlow?: () => void
}

function SSTransactionDetails({
  transactionData,
  account,
  accounts,
  visibility,
  onToggleVisibility,
  onGoToSignFlow
}: SSTransactionDetailsProps) {
  const [accountMatch, setAccountMatch] = useState<AccountMatchResult | null>(
    null
  )
  const { combinedPsbt } = transactionData
  const originalPsbt = extractOriginalPsbt(combinedPsbt)
  const txid = extractTransactionIdFromPSBT(combinedPsbt)
  const multisigInfo = getMultisigInfoFromPsbt(combinedPsbt)

  useEffect(() => {
    async function matchAccount() {
      const match = await findMatchingAccount(originalPsbt, accounts)
      setAccountMatch(match)
    }
    matchAccount()
  }, [originalPsbt, accounts])

  const signedPsbts = extractIndividualSignedPsbts(combinedPsbt, originalPsbt)

  if (!txid) {
    return (
      <SSText size="sm" color="muted">
        {t('account.nostrSync.devicesGroupChat.invalidPsbt')}
      </SSText>
    )
  }

  const keysRequired = multisigInfo?.required || 0
  const keyCount = multisigInfo?.total || 0
  const isMultisig = keyCount > 1

  const matchedAccount = accountMatch?.account || account

  let extractedData = null
  if (originalPsbt && matchedAccount) {
    try {
      extractedData = extractTransactionDataFromPSBTEnhanced(
        originalPsbt,
        matchedAccount
      )
    } catch {
      extractedData = null
    }
  }

  const finalInputs = extractedData?.inputs || []
  const finalOutputs = extractedData?.outputs || []

  const { size, vsize } = legacyEstimateTransactionSize(
    finalInputs.length,
    finalOutputs.length
  )
  const collectedSignatures = Object.keys(signedPsbts || {}).map(Number)
  const vin = finalInputs.map((input) => ({
    previousOutput: { txid: input.txid, vout: input.vout },
    value: input.value,
    label: input.label || ''
  }))
  const vout = finalOutputs.map((output) => ({
    address: output.address,
    value: output.value,
    label: output.label || ''
  }))
  const transaction = {
    id: txid,
    size,
    vsize,
    vin,
    vout
  } as unknown as Transaction

  const textSize = onToggleVisibility ? 'lg' : 'md'

  return (
    <SSVStack
      gap={onToggleVisibility ? 'md' : undefined}
      style={onToggleVisibility && { paddingTop: 10 }}
    >
      <SSHStack justifyBetween>
        <SSText size={textSize} weight="bold">
          {t('account.transaction.signRequest')}
        </SSText>
        <SSText size={textSize} color="muted">
          {`${txid.slice(0, 6)}...${txid.slice(-6)}`}
        </SSText>
      </SSHStack>
      {onToggleVisibility ? (
        <>
          {visibility?.sankey ? (
            <SSTransactionChart transaction={transaction} />
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
            <SSTransactionChart transaction={transaction} />
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
    width: '100%',
    overflow: 'hidden',
    paddingLeft: 8,
    paddingRight: 16
  },
  signatureContainer: {
    alignItems: 'center'
  },
  signFlowButton: {
    marginTop: 8,
    alignSelf: 'flex-start'
  }
})

export default SSTransactionDetails
