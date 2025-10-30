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

// TODO: this variable must be used in other parts of the code to make it
// consistent. For example, the label for the sankey diagram.
const DEFAULT_CHANGE_ADDRESS_LABEL = 'Change'

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

  // we store the labels in account.labels, then later on the labels will be
  // restored when the wallet data is fetched.
  useEffect(() => {
    if (txBuilderResult) {
      const { txid } = txBuilderResult.txDetails
      const labels: Label[] = []

      let txLabelText = ''
      for (let i = 0; i < outputs.length; i += 1) {
        const output = outputs[i]

        // we deal with change address later
        if (output.label === DEFAULT_CHANGE_ADDRESS_LABEL) continue

        const vout = i

        // output label
        const outputRef = `${txid}:${vout}`
        labels.push({
          ref: outputRef,
          label: output.label,
          type: 'output'
        })

        // output's address label
        labels.push({
          ref: output.to,
          type: 'addr',
          label: output.label
        })

        // the tx label will inherit the output's label separated by comma.
        // this is what sparrow does.
        txLabelText += output.label + ','
      }

      // trim the last comma before adding the tx label.
      txLabelText = txLabelText.replace(/,$/, '')
      labels.push({
        ref: txid,
        label: txLabelText,
        type: 'tx'
      })

      // add label to change address if it exists.
      const changeOutputIndex = outputs.findIndex(
        (output) => output.label === DEFAULT_CHANGE_ADDRESS_LABEL
      )
      if (changeOutputIndex) {
        const changeOutput = outputs[changeOutputIndex]
        const changeLabel = `Change for ${txLabelText}`
        labels.push({
          ref: `${txid}:${changeOutputIndex}`,
          type: 'output',
          label: changeLabel
        })
        labels.push({
          ref: changeOutput.to,
          type: 'addr',
          label: changeLabel
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
