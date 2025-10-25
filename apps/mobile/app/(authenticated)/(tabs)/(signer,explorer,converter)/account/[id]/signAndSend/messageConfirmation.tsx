import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { SSIconSuccess } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { type Label } from '@/utils/bip329'
import { formatAddress } from '@/utils/format'

export default function MessageConfirmation() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [clearTransaction, txBuilderResult, broadcasted, outputs] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.clearTransaction,
        state.txBuilderResult,
        state.broadcasted,
        state.outputs
      ])
    )
  const [account, importLabels] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((account) => account.id === id),
      state.importLabels
    ])
  )
  const mempoolConfig = useBlockchainStore((state) => state.configsMempool)

  const webExplorerUrl = useMemo(() => {
    if (!account) return ''
    const { network } = account
    const mempoolServerUrl = mempoolConfig[network]
    return mempoolServerUrl
  }, [account, mempoolConfig])

  function handleBackToHome() {
    clearTransaction()
    router.dismissAll()
    router.navigate(`/account/${id}`)
  }

  // Store the labels (in account.labels) for this transaction.
  // The labels will later appear when the wallet data is fetched.
  useEffect(() => {
    if (txBuilderResult) {
      const { txid } = txBuilderResult.txDetails
      const labels: Label[] = []

      let txLabelText = ''
      for (let i = 0; i < outputs.length; i += 1) {
        const output = outputs[i]

        // if label is empty, it means it is a change address because we
        // enforce labels on all outputs. We deal if it later.
        if (output.label === '') continue

        const vout = i

        // output label
        const outputRef = `${txid}:${vout}`
        labels.push({
          ref: outputRef,
          label: output.label,
          type: 'output'
        })

        // address label
        labels.push({
          ref: output.to,
          type: 'addr',
          label: output.label
        })

        // The tx label will inherit the output's label separated by comma.
        // This is what Sparrow does.
        txLabelText += output.label + ','
      }

      // Trim the last comma before adding the tx label.
      txLabelText = txLabelText.replace(/,$/, '')
      labels.push({
        ref: txid,
        label: txLabelText,
        type: 'tx'
      })

      // Add label to change address if it exists.
      const changeAddressOutput = outputs.find((output) => output.label === '')
      if (changeAddressOutput) {
        labels.push({
          ref: changeAddressOutput.to,
          type: 'addr',
          label: `Change for ${txLabelText}` // TODO: i18n strings
        })
      }

      importLabels(id, labels)
    }
  }, [id, txBuilderResult, outputs, importLabels])

  if (!account || !txBuilderResult) return <Redirect href="/" />

  // Redirect if transaction hasn't been broadcasted
  if (!broadcasted)
    return <Redirect href={`/account/${id}/signAndSend/signMessage`} />

  return (
    <>
      <SSMainLayout style={{ paddingBottom: 32 }}>
        <SSVStack justifyBetween>
          <SSVStack itemsCenter>
            <SSText weight="bold" size="lg">
              {t('sent.broadcasted')}
            </SSText>
            <SSVStack gap="none" itemsCenter>
              <SSText color="muted" uppercase>
                {t('transaction.id')}
              </SSText>
              <SSText>{formatAddress(txBuilderResult.txDetails.txid)}</SSText>
            </SSVStack>
            <SSIconSuccess width={159} height={159} />
          </SSVStack>
          <SSVStack>
            <SSClipboardCopy text={txBuilderResult.txDetails.txid}>
              <SSButton variant="outline" label={t('sent.copyTransactionId')} />
            </SSClipboardCopy>
            <SSButton
              variant="outline"
              label={t('sent.trackOnChain')}
              onPress={() =>
                WebBrowser.openBrowserAsync(
                  `${webExplorerUrl}/tx/${txBuilderResult.txDetails.txid}`
                )
              }
            />
            <SSButton
              variant="secondary"
              label={t('common.backToAccountHome')}
              onPress={() => handleBackToHome()}
            />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
