import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconSuccess } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Transaction } from '@/types/models/Transaction'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { type Label } from '@/utils/bip329'
import { formatAddress } from '@/utils/format'

export default function TransactionConfirmation() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const [externalWarningModalVisible, setExternalWarningModalVisible] =
    useState(false)

  const [clearTransaction, txBuilderResult, broadcasted, outputs, inputs, fee] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.clearTransaction,
        state.txBuilderResult,
        state.broadcasted,
        state.outputs,
        state.inputs,
        state.fee
      ])
    )
  const [account, importLabels, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((account) => account.id === id),
      state.importLabels,
      state.updateAccount
    ])
  )

  const mempoolConfig = useBlockchainStore((state) => state.configsMempool)
  const webExplorerUrl = useMemo(() => {
    if (!account) return ''
    const { network } = account
    const mempoolServerUrl = mempoolConfig[network]
    return mempoolServerUrl
  }, [account, mempoolConfig])

  const mempoolTxUrl = useMemo(() => {
    if (!webExplorerUrl || !txBuilderResult) return ''
    const base = webExplorerUrl.replace(/\/api\/?$/, '')
    return `${base}/tx/${txBuilderResult.txDetails.txid}`
  }, [webExplorerUrl, txBuilderResult])

  function handleViewOnMempool() {
    setExternalWarningModalVisible(true)
  }

  function handleOpenExternalWebsite() {
    if (mempoolTxUrl) WebBrowser.openBrowserAsync(mempoolTxUrl)
    setExternalWarningModalVisible(false)
  }

  function handleBackToHome() {
    clearTransaction()
    router.dismissAll()
    router.navigate(`/signer/bitcoin/account/${id}`)
  }

  // we store the labels in account.labels, then later on the labels will be
  // restored when the wallet data is fetched.
  useEffect(() => {
    if (txBuilderResult) {
      const { txid } = txBuilderResult.txDetails
      const labels: Label[] = []
      const defaultChangeAddressLabel = t('sign.changeAddressLabelDefault')

      let txLabelText = ''
      for (let i = 0; i < outputs.length; i += 1) {
        const output = outputs[i]

        // we deal with change address later
        if (output.label === defaultChangeAddressLabel) continue

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
        (output) => output.label === defaultChangeAddressLabel
      )
      if (changeOutputIndex !== -1) {
        const changeOutput = outputs[changeOutputIndex]
        const changeLabel = t('sign.changeAddressLabelFinal', {
          txlabel: txLabelText
        })
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

      importLabels(id!, labels)
    }
  }, [id, txBuilderResult, outputs, importLabels])

  // Optimistically update the account with the just-broadcast transaction so
  // the user sees it immediately without waiting for a full sync.
  useEffect(() => {
    if (!txBuilderResult || !account || !broadcasted) return

    const { txid } = txBuilderResult.txDetails

    // Idempotent — skip if sync already added it
    if (account.transactions.some((tx) => tx.id === txid)) return

    const inputsList = Array.from(inputs.values())
    const totalIn = inputsList.reduce((sum, u) => sum + u.value, 0)

    const ownAddresses = new Set(account.addresses.map((a) => a.address))
    const receivedChange = outputs
      .filter((o) => ownAddresses.has(o.to))
      .reduce((sum, o) => sum + o.amount, 0)

    const optimisticTx: Transaction = {
      id: txid,
      type: 'send',
      sent: totalIn,
      received: receivedChange,
      timestamp: new Date(),
      blockHeight: undefined,
      fee,
      lockTimeEnabled: false,
      vin: inputsList.map((u) => ({
        previousOutput: { txid: u.txid, vout: u.vout },
        sequence: 0xffffffff,
        scriptSig: [],
        witness: [],
        value: u.value,
        label: u.label
      })),
      vout: outputs.map((o) => ({
        value: o.amount,
        address: o.to,
        script: '',
        label: o.label
      })),
      prices: {}
    }

    const spentOutpoints = new Set(inputsList.map((u) => `${u.txid}:${u.vout}`))
    const remainingUtxos = account.utxos.filter(
      (u) => !spentOutpoints.has(`${u.txid}:${u.vout}`)
    )

    updateAccount({
      ...account,
      transactions: [optimisticTx, ...account.transactions],
      utxos: remainingUtxos,
      summary: {
        ...account.summary,
        balance: account.summary.balance - (totalIn - receivedChange),
        numberOfTransactions: account.summary.numberOfTransactions + 1,
        numberOfUtxos: remainingUtxos.length
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect if transaction hasn't been broadcasted
  useEffect(() => {
    if (!broadcasted && account && txBuilderResult) {
      router.replace(
        `/signer/bitcoin/account/${id}/signAndSend/signTransaction`
      )
    }
  }, [broadcasted, account, txBuilderResult, id, router])

  if (!account || !txBuilderResult) return <Redirect href="/" />

  if (!broadcasted) return null

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
              label={t('sent.viewOnMempool')}
              onPress={handleViewOnMempool}
            />
            <SSButton
              variant="secondary"
              label={t('common.backToAccountHome')}
              onPress={() => handleBackToHome()}
            />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
      <SSModal
        fullOpacity
        visible={externalWarningModalVisible}
        label=""
        onClose={() => setExternalWarningModalVisible(false)}
      >
        <SSVStack justifyBetween style={{ flex: 1, width: '100%' }}>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <SSVStack gap="lg" style={{ alignItems: 'center' }}>
              <SSText uppercase weight="bold">
                {t('common.warning')}
              </SSText>
              <SSText color="muted" center>
                {t('sent.externalWebsiteWarning')}
              </SSText>
            </SSVStack>
          </View>
          <SSVStack gap="md">
            <SSButton
              variant="danger"
              label={t('common.open')}
              onPress={handleOpenExternalWebsite}
            />
            <SSButton
              variant="ghost"
              label={t('common.cancel')}
              onPress={() => setExternalWarningModalVisible(false)}
            />
          </SSVStack>
        </SSVStack>
      </SSModal>
    </>
  )
}
