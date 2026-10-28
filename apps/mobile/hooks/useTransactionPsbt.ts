import { useEffect, useEffectEvent, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { buildPsbtWithRpcOrBdkWallet } from '@/api/bdk'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'
import { type PsbtBuildStatus } from '@/types/models/Psbt'
import { type Message, type Notice } from '@/types/ui/notice'
import {
  createMockPsbt,
  createPlaceholderTransactionId,
  type ExtractedTransactionData,
  extractTransactionDataFromPSBT,
  extractTransactionDataFromPSBTEnhanced,
  generateTransactionId,
  getPsbtExtractionNotice
} from '@/utils/psbt'
import {
  findFirstInvalidOutputAddress,
  mapBuildTransactionError
} from '@/utils/transaction'

type PreviewBuildRun = { isCancelled: boolean }

type UseTransactionPsbtParams = {
  account: Account | undefined
  accountId: Account['id']
  importedPsbtBase64: string | undefined
  onNotice: (notice: Notice) => void
}

export function useTransactionPsbt({
  account,
  accountId,
  importedPsbtBase64,
  onNotice
}: UseTransactionPsbtParams) {
  const [
    inputs,
    outputs,
    fee,
    rbf,
    isPsbtPrebuilt,
    replacesTxid,
    setPsbt,
    txBuilderResult,
    setSignedTx,
    addInput,
    addOutput,
    setFee,
    setRbf,
    clearTransaction,
    clearPsbt
  ] = useTransactionBuilderStore(
    useShallow((state) => [
      state.inputs,
      state.outputs,
      state.fee,
      state.rbf,
      state.isPsbtPrebuilt,
      state.replacesTxid,
      state.setPsbt,
      state.psbt,
      state.setSignedTx,
      state.addInput,
      state.addOutput,
      state.setFee,
      state.setRbf,
      state.clearTransaction,
      state.clearPsbt
    ])
  )
  const wallet = useGetAccountWallet(accountId)
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const { server } = useBlockchainStore(
    (state) => state.configs[state.selectedNetwork]
  )

  const [transactionId, setTransactionId] = useState('')
  const [isLoadingPSBT, setIsLoadingPSBT] = useState(false)
  const [psbtBuildStatus, setPsbtBuildStatus] =
    useState<PsbtBuildStatus>('idle')
  const [psbtBuildError, setPsbtBuildError] = useState<Message | null>(null)
  const [isDustError, setIsDustError] = useState(false)

  function addExtractedPsbtDataToBuilder(
    extractedData: ExtractedTransactionData
  ) {
    for (const input of extractedData.inputs) {
      addInput({
        addressTo: input.address,
        keychain: input.keychain || 'external',
        label: input.label,
        script: Buffer.from(input.script, 'hex').toJSON().data,
        txid: input.txid,
        value: input.value,
        vout: input.vout
      })
    }

    for (const output of extractedData.outputs) {
      addOutput({
        amount: output.value,
        label: output.label || '',
        to: output.address
      })
    }

    if (extractedData.fee) {
      setFee(extractedData.fee)
    }

    setRbf(true)
  }

  function importPsbtWithoutAccountContext(psbtBase64: string) {
    const extractedData = extractTransactionDataFromPSBT(psbtBase64, network)
    if (extractedData) {
      addExtractedPsbtDataToBuilder(extractedData)
    }
    const txid = generateTransactionId(psbtBase64)
    setTransactionId(txid)
    const mockResult = createMockPsbt(psbtBase64, txid, extractedData?.fee ?? 0)
    setPsbt(mockResult)
    setIsLoadingPSBT(false)
  }

  function importPsbtWithoutAccountContextAndNotify(
    psbtBase64: string,
    successNoticeKey: string
  ) {
    try {
      importPsbtWithoutAccountContext(psbtBase64)
      onNotice({ key: successNoticeKey, type: 'info' })
    } catch {
      setIsLoadingPSBT(false)
      onNotice({ key: 'common.error.processPSBT', type: 'error' })
      setTransactionId(createPlaceholderTransactionId('ERROR'))
    }
  }

  function extractAccountPsbtDataOrWarn(
    psbtBase64: string,
    accountData: NonNullable<typeof account>
  ) {
    try {
      const extractedData = extractTransactionDataFromPSBTEnhanced(
        psbtBase64,
        accountData
      )
      if (!extractedData) {
        onNotice({
          key: 'transaction.preview.psbtNotMatchAccount',
          type: 'warning'
        })
      }
      return extractedData
    } catch (error) {
      onNotice(getPsbtExtractionNotice(error))
      return null
    }
  }

  function importPsbtWithAccount(
    psbtBase64: string,
    accountData: NonNullable<typeof account>
  ) {
    const extractedData = extractAccountPsbtDataOrWarn(psbtBase64, accountData)
    if (!extractedData) {
      importPsbtWithoutAccountContextAndNotify(
        psbtBase64,
        'transaction.preview.psbtLoadedBasic'
      )
      return
    }

    addExtractedPsbtDataToBuilder(extractedData)
    const txid = generateTransactionId(psbtBase64)
    setTransactionId(txid)
    setPsbt(createMockPsbt(psbtBase64, txid, extractedData.fee))
    setIsLoadingPSBT(false)
  }

  const importPsbtWithLatestAccount = useEffectEvent((psbtBase64: string) => {
    setIsLoadingPSBT(true)
    clearTransaction()
    setSignedTx('')

    if (!account) {
      importPsbtWithoutAccountContextAndNotify(
        psbtBase64,
        'transaction.preview.psbtLoadedLimited'
      )
      return
    }
    importPsbtWithAccount(psbtBase64, account)
  })

  const loadedAccountIdToReimportOn = account?.id
  useEffect(() => {
    if (!importedPsbtBase64) {
      return
    }
    importPsbtWithLatestAccount(importedPsbtBase64)
  }, [importedPsbtBase64, loadedAccountIdToReimportOn])

  function failBuild(key: string) {
    setPsbtBuildStatus('error')
    setPsbtBuildError({ key })
  }

  function markExistingPsbtAsBuilt() {
    setPsbtBuildStatus('idle')
    setPsbtBuildError(null)
    const importedTxid = txBuilderResult?.txid()
    if (importedTxid) {
      setTransactionId(importedTxid)
    }
  }

  const buildPreviewPsbtFromBuilderState = useEffectEvent(
    async (buildRun: PreviewBuildRun) => {
      if (importedPsbtBase64 || isPsbtPrebuilt) {
        markExistingPsbtAsBuilt()
        return
      }

      clearPsbt()
      setTransactionId('')
      setPsbtBuildStatus('building')
      setPsbtBuildError(null)

      if (!wallet) {
        failBuild('transaction.error.previewMissingWallet')
        onNotice({ key: 'error.notFound.wallet', type: 'error' })
        return
      }
      if (inputs.size === 0) {
        failBuild('transaction.error.previewMissingInputs')
        return
      }
      if (outputs.length === 0) {
        failBuild('transaction.error.previewMissingOutputs')
        return
      }
      // The inputs are spent by the transaction being replaced, so only
      // BDK's replace-by-fee can build it again.
      if (replacesTxid) {
        failBuild('transaction.feeReplacement.error.rebuild')
        return
      }

      try {
        const inputArray = [...inputs.values()]
        const outputArray = [...outputs.values()]

        const transaction = await buildPsbtWithRpcOrBdkWallet(
          wallet,
          server,
          account,
          {
            fee,
            inputs: inputArray,
            options: { rbf },
            outputs: outputArray
          }
        )

        if (buildRun.isCancelled) {
          return
        }

        setTransactionId(transaction.txid())
        setPsbt(transaction)
        setPsbtBuildStatus('idle')
        setPsbtBuildError(null)
        setIsDustError(false)
      } catch (error) {
        if (buildRun.isCancelled) {
          return
        }

        const { isDust, message, notice } = mapBuildTransactionError(error)
        setPsbtBuildStatus('error')
        setPsbtBuildError(message)
        setIsDustError(isDust)
        if (notice) {
          onNotice(notice)
        }
      }
    }
  )

  useEffect(() => {
    const buildRun: PreviewBuildRun = { isCancelled: false }
    void buildPreviewPsbtFromBuilderState(buildRun)
    return () => {
      buildRun.isCancelled = true
    }
  }, [
    wallet,
    inputs,
    outputs,
    fee,
    rbf,
    network,
    importedPsbtBase64,
    isPsbtPrebuilt,
    replacesTxid
  ])

  const reportInvalidOutputAddress = useEffectEvent((address: string) => {
    onNotice({
      key: 'transaction.preview.invalidAddressFormat',
      params: { address },
      type: 'error'
    })
  })

  const accountNetwork = account?.network
  useEffect(() => {
    if (!accountNetwork || !txBuilderResult) {
      return
    }
    const invalidAddress = findFirstInvalidOutputAddress(
      outputs,
      accountNetwork
    )
    if (invalidAddress) {
      reportInvalidOutputAddress(invalidAddress)
    }
  }, [accountNetwork, outputs, txBuilderResult])

  const psbtBase64 = txBuilderResult?.toBase64()
  const serializedPsbt = psbtBase64
    ? Buffer.from(psbtBase64, 'base64').toString('hex')
    : ''

  return {
    isDustError,
    isLoadingPSBT,
    psbtBuildError,
    psbtBuildStatus,
    serializedPsbt,
    transactionId
  }
}
