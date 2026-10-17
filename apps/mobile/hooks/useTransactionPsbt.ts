import { useEffect, useEffectEvent, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { buildPsbt, buildTransaction } from '@/api/bdk'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'
import { type PsbtBuildStatus } from '@/types/models/Psbt'
import { type Message, type Notice } from '@/types/ui/notice'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import {
  createMockPsbt,
  createPlaceholderTransactionId,
  type ExtractedTransactionData,
  extractTransactionDataFromPSBT,
  extractTransactionDataFromPSBTEnhanced,
  generateTransactionId
} from '@/utils/psbt'
import { validateAddress } from '@/utils/validation'

// Shorter output addresses are likely still being typed.
const MIN_VALID_ADDRESS_LENGTH = 10

type UseTransactionPsbtParams = {
  account: Account | undefined
  accountId: Account['id']
  /** A PSBT (base64) to review instead of building one, e.g. from the route. */
  routePsbt: string | undefined
  onNotice: (notice: Notice) => void
}

/**
 * The PSBT under review: imports `routePsbt` into the transaction builder, or
 * builds a PSBT from the builder's inputs, outputs and fee. Reports progress
 * and problems through `onNotice` and the returned build status.
 */
export function useTransactionPsbt({
  account,
  accountId,
  routePsbt,
  onNotice
}: UseTransactionPsbtParams) {
  const [
    inputs,
    outputs,
    fee,
    rbf,
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

  function processExtractedPsbtData(extractedData: ExtractedTransactionData) {
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

  function processBasicPsbt(psbtBase64: string) {
    const extractedData = extractTransactionDataFromPSBT(psbtBase64, network)
    if (extractedData) {
      processExtractedPsbtData(extractedData)
    }
    const txid = generateTransactionId(psbtBase64)
    setTransactionId(txid)
    const mockResult = createMockPsbt(psbtBase64, txid, extractedData?.fee ?? 0)
    setPsbt(mockResult)
    setIsLoadingPSBT(false)
  }

  // Loads a PSBT without account context, reporting `successKey` on success.
  function loadBasicPsbt(psbtBase64: string, successKey: string) {
    try {
      processBasicPsbt(psbtBase64)
      onNotice({ key: successKey, type: 'info' })
    } catch {
      setIsLoadingPSBT(false)
      onNotice({ key: 'common.error.processPSBT', type: 'error' })
      setTransactionId(createPlaceholderTransactionId('ERROR'))
    }
  }

  // Account-aware PSBT data, or null (after a warning) when it doesn't match.
  function readAccountPsbtData(
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

  function processPsbtWithAccount(
    psbtBase64: string,
    accountData: NonNullable<typeof account>
  ) {
    const extractedData = readAccountPsbtData(psbtBase64, accountData)
    if (!extractedData) {
      loadBasicPsbt(psbtBase64, 'transaction.preview.psbtLoadedBasic')
      return
    }

    processExtractedPsbtData(extractedData)
    const txid = generateTransactionId(psbtBase64)
    setTransactionId(txid)
    setPsbt(createMockPsbt(psbtBase64, txid, extractedData.fee))
    setIsLoadingPSBT(false)
  }

  function processPsbtWithoutAccount(psbtBase64: string) {
    loadBasicPsbt(psbtBase64, 'transaction.preview.psbtLoadedLimited')
  }

  // Reads the latest account without making every account update re-import
  // the PSBT (which would clear the transaction and any signatures).
  const loadRoutePsbt = useEffectEvent((psbtBase64: string) => {
    setIsLoadingPSBT(true)
    clearTransaction()
    setSignedTx('')

    if (account) {
      processPsbtWithAccount(psbtBase64, account)
    } else {
      processPsbtWithoutAccount(psbtBase64)
    }
  })

  // Re-import once the account loads, not on every account update.
  const loadedAccountId = account?.id
  useEffect(() => {
    if (!routePsbt) {
      return
    }
    loadRoutePsbt(routePsbt)
  }, [routePsbt, loadedAccountId])

  function failBuild(key: string) {
    setPsbtBuildStatus('error')
    setPsbtBuildError({ key })
  }

  // Builds the preview PSBT from the builder state. Reads account and server
  // at build time, so their updates do not trigger a rebuild loop.
  const buildPreviewPsbt = useEffectEvent(
    async (request: { cancelled: boolean }) => {
      if (routePsbt) {
        setPsbtBuildStatus('idle')
        setPsbtBuildError(null)
        if (txBuilderResult?.txid()) {
          setTransactionId(txBuilderResult.txid())
        }
        return
      }

      clearPsbt()
      setTransactionId('')
      setPsbtBuildStatus('building')
      setPsbtBuildError(null)

      // Checked before any await, so the request cannot be cancelled yet.
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

      try {
        const inputArray = Array.from(inputs.values())
        const outputArray = Array.from(outputs.values())

        const transaction = account
          ? await buildPsbt(wallet, server, account, {
              fee,
              inputs: inputArray,
              options: { rbf },
              outputs: outputArray
            })
          : await buildTransaction(wallet, {
              fee,
              inputs: inputArray,
              options: { rbf },
              outputs: outputArray
            })

        if (request.cancelled) {
          return
        }

        setTransactionId(transaction.txid())
        setPsbt(transaction)
        setPsbtBuildStatus('idle')
        setPsbtBuildError(null)
        setIsDustError(false)
      } catch (error) {
        if (request.cancelled) {
          return
        }

        const { message, isDust } = mapBuildTransactionError(error)
        setPsbtBuildStatus('error')
        setPsbtBuildError(message)
        setIsDustError(isDust)

        if (isDust) {
          return
        }

        if (String(error).includes('UTXO not found')) {
          onNotice({ key: 'transaction.preview.utxoNotFound', type: 'error' })
        } else {
          onNotice({ ...message, type: 'error' })
        }
      }
    }
  )

  useEffect(() => {
    const request = { cancelled: false }
    void buildPreviewPsbt(request)
    return () => {
      request.cancelled = true
    }
  }, [wallet, inputs, outputs, fee, rbf, network, routePsbt])

  const reportInvalidAddress = useEffectEvent((address: string) => {
    onNotice({
      key: 'transaction.preview.invalidAddressFormat',
      params: { address },
      type: 'error'
    })
  })

  // Reports the first output address that is invalid for the account's
  // network once a PSBT is built. Short addresses are likely still being typed.
  useEffect(() => {
    if (!account || !outputs.length || !txBuilderResult) {
      return
    }

    const network = bitcoinjsNetwork(account.network)
    const invalidOutput = outputs.find(
      (output) =>
        output.to.trim().length >= MIN_VALID_ADDRESS_LENGTH &&
        !validateAddress(output.to, network)
    )
    if (invalidOutput) {
      reportInvalidAddress(invalidOutput.to)
    }
  }, [account, outputs, txBuilderResult])

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

// Dust failures get a dedicated message; other build errors show the
// library's own message.
function mapBuildTransactionError(error: unknown): {
  isDust: boolean
  message: Message
} {
  const errorMessage = error instanceof Error ? error.message : String(error)
  if (errorMessage.toLowerCase().includes('dust')) {
    return {
      isDust: true,
      message: { key: 'transaction.error.previewBuildFailedDust' }
    }
  }
  return { isDust: false, message: { text: errorMessage } }
}

// Classifies why reading a PSBT with the account's keys failed.
function getPsbtExtractionNotice(error: unknown): Notice {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'

  if (
    errorMessage.includes('fingerprint') ||
    errorMessage.includes('derivation') ||
    errorMessage.includes('not match')
  ) {
    return { key: 'transaction.preview.psbtNotMatchAccount', type: 'warning' }
  }
  if (
    errorMessage.includes('Invalid PSBT') ||
    errorMessage.includes('malformed')
  ) {
    return { key: 'transaction.preview.psbtInvalidFormat', type: 'error' }
  }
  return { key: 'transaction.preview.psbtEnhancedFailed', type: 'warning' }
}
