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

  const [clearTransaction, psbt, broadcasted, outputs, inputs, fee] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.clearTransaction,
        state.psbt,
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
    if (!account) {
      return ''
    }
    const { network } = account
    const mempoolServerUrl = mempoolConfig[network]
    return mempoolServerUrl
  }, [account, mempoolConfig])

  const mempoolTxUrl = useMemo(() => {
    if (!webExplorerUrl || !psbt) {
      return ''
    }
    const base = webExplorerUrl.replace(/\/api\/?$/, '')
    return `${base}/tx/${psbt.txid()}`
  }, [webExplorerUrl, psbt])

  function handleViewOnMempool() {
    setExternalWarningModalVisible(true)
  }

  function handleOpenExternalWebsite() {
    if (mempoolTxUrl) {
      WebBrowser.openBrowserAsync(mempoolTxUrl)
    }
    setExternalWarningModalVisible(false)
  }

  function handleBackToHome() {
    clearTransaction()
    router.dismissAll()
    router.navigate(`/signer/bitcoin/account/${id}`)
  }

  const defaultChangeAddressLabel = t('sign.changeAddressLabelDefault')

  const txLabelText = outputs
    .filter((o) => o.label !== defaultChangeAddressLabel)
    .map((o) => o.label)
    .filter(Boolean)
    .join(',')

  // we store the labels in account.labels, then later on the labels will be
  // restored when the wallet data is fetched.
  useEffect(() => {
    if (psbt) {
      const txid = psbt.txid()
      const labels: Label[] = []

      for (let i = 0; i < outputs.length; i += 1) {
        const output = outputs[i]

        // we deal with change address later
        if (output.label === defaultChangeAddressLabel) {
          continue
        }

        const vout = i

        // output label
        const outputRef = `${txid}:${vout}`
        labels.push({
          label: output.label,
          ref: outputRef,
          type: 'output'
        })

        // output's address label
        labels.push({
          label: output.label,
          ref: output.to,
          type: 'addr'
        })
      }

      // the tx label inherits the output labels separated by comma.
      labels.push({
        label: txLabelText,
        ref: txid,
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
          label: changeLabel,
          ref: `${txid}:${changeOutputIndex}`,
          type: 'output'
        })
        labels.push({
          label: changeLabel,
          ref: changeOutput.to,
          type: 'addr'
        })
      }

      importLabels(id!, labels)
    }
  }, [id, psbt, outputs, importLabels, defaultChangeAddressLabel, txLabelText])

  // Optimistically update the account with the just-broadcast transaction so
  // the user sees it immediately without waiting for a full sync.
  useEffect(() => {
    if (!psbt || !account || !broadcasted) {
      return
    }

    const txid = psbt.txid()

    // Idempotent — skip if sync already added it
    if (account.transactions.some((tx) => tx.id === txid)) {
      return
    }

    const inputsList = Array.from(inputs.values())
    const totalIn = inputsList.reduce((sum, u) => sum + u.value, 0)

    const ownAddresses = new Set(account.addresses.map((a) => a.address))
    const receivedChange = outputs
      .filter((o) => ownAddresses.has(o.to))
      .reduce((sum, o) => sum + o.amount, 0)

    const optimisticTx: Transaction = {
      blockHeight: undefined,
      fee,
      id: txid,
      label: txLabelText || undefined,
      lockTimeEnabled: false,
      prices: {},
      received: receivedChange,
      sent: totalIn,
      timestamp: new Date(),
      type: 'send',
      vin: inputsList.map((u) => ({
        label: u.label,
        previousOutput: { txid: u.txid, vout: u.vout },
        scriptSig: [],
        sequence: 0xffffffff,
        value: u.value,
        witness: []
      })),
      vout: outputs.map((o) => ({
        address: o.to,
        label: o.label,
        script: '',
        value: o.amount
      }))
    }

    const spentOutpoints = new Set(inputsList.map((u) => `${u.txid}:${u.vout}`))
    const remainingUtxos = account.utxos.filter(
      (u) => !spentOutpoints.has(`${u.txid}:${u.vout}`)
    )

    updateAccount({
      ...account,
      summary: {
        ...account.summary,
        balance: account.summary.balance - (totalIn - receivedChange),
        numberOfTransactions: account.summary.numberOfTransactions + 1,
        numberOfUtxos: remainingUtxos.length
      },
      transactions: [optimisticTx, ...account.transactions],
      utxos: remainingUtxos
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect if transaction hasn't been broadcasted
  useEffect(() => {
    if (!broadcasted && account && psbt) {
      router.replace(
        `/signer/bitcoin/account/${id}/signAndSend/signTransaction`
      )
    }
  }, [broadcasted, account, psbt, id, router])

  if (!account || !psbt) {
    return <Redirect href="/" />
  }

  if (!broadcasted) {
    return null
  }

  return (
    <>
      <SSMainLayout style={{ paddingBottom: 32 }}>
        <SSVStack justifyBetween>
          <SSVStack itemsCenter>
            <SSText size="md" uppercase weight="light">
              {t('sent.broadcasted')}
            </SSText>
            <SSVStack gap="none" itemsCenter>
              <SSText color="muted" uppercase>
                {t('transaction.id')}
              </SSText>
              <SSText>{formatAddress(psbt.txid())}</SSText>
            </SSVStack>
            <SSIconSuccess width={159} height={159} />
          </SSVStack>
          <SSVStack>
            <SSClipboardCopy text={psbt.txid()}>
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
