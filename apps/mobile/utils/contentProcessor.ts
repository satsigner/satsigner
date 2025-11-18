// @ts-nocheck
import {
  PartiallySignedTransaction,
  type TransactionDetails,
  type TxBuilderResult
} from 'bdk-rn/lib/classes/Bindings'
import * as bitcoinjs from 'bitcoinjs-lib'
import { Buffer } from 'buffer'
import { router } from 'expo-router'
import { toast } from 'sonner-native'

import { SATS_PER_BITCOIN } from '@/constants/btc'
import { t } from '@/locales'
import { type Account } from '@/types/models/Account'
import { type Utxo } from '@/types/models/Utxo'
import { extractKeyFingerprint } from '@/utils/account'
import { bip21decode } from '@/utils/bitcoin'
import { type DetectedContent } from '@/utils/contentDetector'
import {
  combinePsbts,
  extractIndividualSignedPsbts,
  extractOriginalPsbt,
  extractTransactionDataFromPSBTEnhanced,
  extractTransactionIdFromPSBT,
  findMatchingAccount,
  getCollectedSignerPubkeys
} from '@/utils/psbt'
import { selectEfficientUtxos } from '@/utils/utxo'

export type ProcessorActions = {
  navigate: (
    path: string | { pathname: string; params?: Record<string, unknown> }
  ) => void
  clearTransaction?: () => void
  addOutput?: (output: { amount: number; label: string; to: string }) => void
  addInput?: (input: Utxo) => void
  setFeeRate?: (rate: number) => void
  setRbf?: (enabled: boolean) => void
  setSignedPsbts?: (psbts: Map<number, string>) => void
  setTxBuilderResult?: (result: TxBuilderResult) => void
}

/**
 * Auto-select UTXOs based on target amount
 */
function autoSelectUtxos(
  account: Account,
  targetAmount: number,
  actions: Pick<ProcessorActions, 'addInput' | 'setFeeRate'>
) {
  if (!account || account.utxos.length === 0) return

  const { addInput, setFeeRate } = actions

  // Set a default fee rate if not set
  if (setFeeRate && typeof setFeeRate === 'function') {
    setFeeRate(1) // Default to 1 sat/vbyte
  }

  // If no target amount, select the highest value UTXO
  if (targetAmount === 0 || targetAmount === 1) {
    const highestUtxo = account.utxos.reduce((max: Utxo, utxo: Utxo) =>
      utxo.value > max.value ? utxo : max
    )
    addInput?.(highestUtxo)
    return
  }

  // Use efficient UTXO selection for the target amount
  const result = selectEfficientUtxos(
    account.utxos,
    targetAmount,
    1, // Default fee rate of 1 sat/vbyte
    {
      dustThreshold: 546,
      inputSize: 148,
      changeOutputSize: 34
    }
  )

  if (result.error) {
    // Fallback: select the highest value UTXO
    const highestUtxo = account.utxos.reduce((max: Utxo, utxo: Utxo) =>
      utxo.value > max.value ? utxo : max
    )
    addInput?.(highestUtxo)
  } else {
    // Add all selected UTXOs as inputs
    result.inputs.forEach((utxo) => addInput?.(utxo))
  }
}

/**
 * Process Bitcoin content (addresses, URIs, PSBTs)
 */
async function processBitcoinContent(
  content: DetectedContent,
  actions: ProcessorActions,
  accountId: string,
  account?: Account
) {

  const { navigate, clearTransaction, addOutput } = actions

  if (clearTransaction) {
    clearTransaction()
  }

  switch (content.type) {
    case 'psbt':
      // Convert hex PSBT to base64 if needed
      let psbtBase64 = content.cleaned
      if (/^[0-9a-fA-F]+$/.test(content.cleaned.trim())) {
        // It's a hex PSBT, convert to base64
        psbtBase64 = Buffer.from(content.cleaned, 'hex').toString('base64')
      }

      // Navigate immediately to improve UX - processing will happen on preview page
      const psbtParam = encodeURIComponent(psbtBase64)
      navigate(
        `/account/${accountId}/signAndSend/previewMessage?psbt=${psbtParam}`
      )

      // Enhanced PSBT processing using the tools from nostr multisig
      // This now happens in the background on the preview page
      if (account) {
        try {
          // Check if this PSBT matches the current account
          const accountMatch = await findMatchingAccount(psbtBase64, [account])

          if (accountMatch) {
            const originalPsbt = extractOriginalPsbt(psbtBase64)

            // Extract transaction data and populate the transaction builder
            const extractedData = extractTransactionDataFromPSBTEnhanced(
              originalPsbt,
              account
            )

            if (extractedData) {
              const inputs = extractedData?.inputs || []
              const outputs = extractedData?.outputs || []
              const fee = extractedData?.fee || 0

              // Set RBF to true for PSBTs
              actions.setRbf?.(true)

              const finalSignedPsbtsMap = new Map<number, string>()

              if (accountMatch.account.policyType === 'multisig') {
                const combinedPsbt = bitcoinjs.Psbt.fromBase64(psbtBase64)

                const keyFingerprintToCosignerIndex = new Map<string, number>()
                await Promise.all(
                  accountMatch.account.keys.map(async (key, index) => {
                    const fp = await extractKeyFingerprint(key)
                    if (fp) keyFingerprintToCosignerIndex.set(fp, index)
                  })
                )

                const pubkeyToCosignerIndex = new Map<string, number>()
                combinedPsbt.data.inputs.forEach((input) => {
                  if (input.bip32Derivation) {
                    input.bip32Derivation.forEach((derivation) => {
                      const fingerprint =
                        derivation.masterFingerprint.toString('hex')
                      const pubkey = derivation.pubkey.toString('hex')
                      const cosignerIndex =
                        keyFingerprintToCosignerIndex.get(fingerprint)

                      if (cosignerIndex !== undefined) {
                        pubkeyToCosignerIndex.set(pubkey, cosignerIndex)
                      }
                    })
                  }
                  if (input.partialSig) {
                    input.partialSig.forEach((sig) => {
                      // Calculate fingerprint from the public key
                      bitcoinjs.crypto
                        .hash160(sig.pubkey)
                        .slice(0, 4)
                        .toString('hex')
                    })
                  }
                })

                const individualSignedPsbts = extractIndividualSignedPsbts(
                  psbtBase64,
                  originalPsbt
                )

                const psbtsByCosigner = new Map<number, string[]>()

                Object.values(individualSignedPsbts).forEach((psbtStr) => {
                  const pubkeys = getCollectedSignerPubkeys(psbtStr)
                  if (pubkeys.size > 0) {
                    const pubkey = pubkeys.values().next().value
                    const cosignerIndex = pubkeyToCosignerIndex.get(pubkey)
                    if (cosignerIndex !== undefined) {
                      if (!psbtsByCosigner.has(cosignerIndex)) {
                        psbtsByCosigner.set(cosignerIndex, [])
                      }
                      psbtsByCosigner.get(cosignerIndex)!.push(psbtStr)
                    }
                  }
                })

                for (const [
                  cosignerIndex,
                  psbts
                ] of psbtsByCosigner.entries()) {
                  if (psbts.length > 1) {
                    const combined = combinePsbts(psbts)
                    finalSignedPsbtsMap.set(cosignerIndex, combined)
                  } else {
                    finalSignedPsbtsMap.set(cosignerIndex, psbts[0])
                  }
                }
              } else {
                // For single-sig, we can just use the combined psbt as is.
                // It will be assigned to the first cosigner (index 0).
                const individualSignedPsbts = extractIndividualSignedPsbts(
                  psbtBase64,
                  originalPsbt
                )
                Object.entries(individualSignedPsbts).forEach(
                  ([key, value]) => {
                    finalSignedPsbtsMap.set(parseInt(key, 10), value as string)
                  }
                )
              }
              actions.setSignedPsbts?.(finalSignedPsbtsMap)

              const extractedTxid = extractTransactionIdFromPSBT(originalPsbt)
              if (!extractedTxid) {
                return
              }

              const sent = outputs.reduce(
                (
                  acc: number,
                  output: { address: string; value: number; label: string }
                ) => acc + output.value,
                0
              )
              const received = inputs.reduce(
                (acc: number, input: Utxo) => acc + (input.value || 0),
                0
              )

              const psbt = new PartiallySignedTransaction(originalPsbt)

              const txDetails: TransactionDetails = {
                txid: extractedTxid,
                fee,
                sent,
                received,
                confirmationTime: undefined,
                transaction: undefined
              }

              const txBuilderResult: TxBuilderResult = {
                psbt,
                txDetails
              }
              actions.setTxBuilderResult?.(txBuilderResult)
            }
          }

          // Processing happens on preview page now
        } catch (error) {
          // Errors will be shown on the preview page
          // Navigation already happened above
        }
      }
      break

    case 'bitcoin_descriptor':
      router.push(
          `/account/add/watchOnly?descriptor=${content.cleaned
          }`
        )
      break

    case 'bitcoin_transaction':
      navigate({
        pathname: '/account/[id]/signAndSend/previewMessage',
        params: { id: accountId, signedPsbt: content.cleaned }
      })
      break

    case 'bitcoin_uri':
      try {
        // First try with bitcoin: prefix if not present
        let uriToDecode = content.cleaned
        if (!uriToDecode.toLowerCase().startsWith('bitcoin:')) {
          uriToDecode = `bitcoin:${uriToDecode}`
        }

        const decodedData = bip21decode(uriToDecode)
        if (decodedData && typeof decodedData === 'object') {
          const amount =
            (decodedData.options.amount || 0) * SATS_PER_BITCOIN || 1

          // Check if amount exceeds wallet balance
          if (account && account.summary && amount > account.summary.balance) {
            const formattedAmount = amount.toLocaleString()
            const formattedBalance = account.summary.balance.toLocaleString()
            let errorMessage = t('error.amountExceedsBalance', {
              amount: formattedAmount,
              balance: formattedBalance
            })
            // Check if translation was found (i18n-js returns key or "missing" message if not found)
            if (
              errorMessage.includes('missing') ||
              errorMessage === 'error.amountExceedsBalance'
            ) {
              // Fallback: construct message from translation keys
              const amountLabel = t('common.amount')
              const satsLabel = t('common.sats')
              const exceedsLabel = t('common.exceeds')
              const walletBalanceLabel = t('wallet.balance')
              errorMessage = `${amountLabel} (${formattedAmount} ${satsLabel}) ${exceedsLabel} ${walletBalanceLabel} (${formattedBalance} ${satsLabel})`
            }
            toast.error(errorMessage)
            return
          }

          if (addOutput) {
            addOutput({
              amount,
              label: decodedData.options.label || '',
              to: decodedData.address
            })
          }

          // Auto-select UTXOs if account is available
          if (account && addOutput) {
            autoSelectUtxos(account, amount, actions)
          }

          navigate({
            pathname: '/account/[id]/signAndSend/ioPreview',
            params: { id: accountId }
          })
        } else {
          // If decoding returns just an address string, parse manually
          const addressMatch = content.cleaned.match(
            /^([a-zA-Z0-9]{26,62})(\?.*)?$/
          )
          if (addressMatch) {
            const address = addressMatch[1]
            const queryString = addressMatch[2] || ''

            let amount = 1
            let label = ''

            // Parse query parameters manually
            if (queryString) {
              const params = new URLSearchParams(queryString.substring(1)) // Remove the '?'
              const amountParam = params.get('amount')
              const labelParam = params.get('label')

              if (amountParam) {
                amount =
                  Math.round(parseFloat(amountParam) * SATS_PER_BITCOIN) || 1
              }
              if (labelParam) {
                label = decodeURIComponent(labelParam)
              }
            }

            // Check if amount exceeds wallet balance
            if (
              account &&
              account.summary &&
              amount > account.summary.balance
            ) {
              const formattedAmount = amount.toLocaleString()
              const formattedBalance = account.summary.balance.toLocaleString()
              let errorMessage = t('error.amountExceedsBalance', {
                amount: formattedAmount,
                balance: formattedBalance
              })
              // Check if translation was found (i18n-js returns key or "missing" message if not found)
              if (
                errorMessage.includes('missing') ||
                errorMessage === 'error.amountExceedsBalance'
              ) {
                // Fallback: construct message from translation keys
                const amountLabel = t('common.amount')
                const satsLabel = t('common.sats')
                const exceedsLabel = t('common.exceeds')
                const walletBalanceLabel = t('wallet.balance')
                errorMessage = `${amountLabel} (${formattedAmount} ${satsLabel}) ${exceedsLabel} ${walletBalanceLabel} (${formattedBalance} ${satsLabel})`
              }
              toast.error(errorMessage)
              return
            }

            if (addOutput) {
              addOutput({
                amount,
                label,
                to: address
              })
            }

            if (account) {
              autoSelectUtxos(account, amount, actions)
            }

            navigate({
              pathname: '/account/[id]/signAndSend/ioPreview',
              params: { id: accountId }
            })
          }
        }
      } catch {
        // If URI decoding fails, treat as address
        if (addOutput) {
          addOutput({
            amount: 1,
            label: '',
            to: content.cleaned
          })
        }

        if (account) {
          autoSelectUtxos(account, 1, actions)
        }

        navigate({
          pathname: '/account/[id]/signAndSend/ioPreview',
          params: { id: accountId }
        })
      }
      break

    case 'bitcoin_address':
      if (addOutput) {
        addOutput({
          amount: 1,
          label: '',
          to: content.cleaned
        })
      }

      if (account) {
        autoSelectUtxos(account, 1, actions)
      }

      navigate({
        pathname: '/account/[id]/signAndSend/ioPreview',
        params: { id: accountId }
      })
      break
  }
}

/**
 * Process Lightning content (invoices, LNURLs)
 */
function processLightningContent(
  content: DetectedContent,
  actions: ProcessorActions
) {
  const { navigate } = actions

  switch (content.type) {
    case 'lightning_invoice':
    case 'lnurl':
      navigate({
        pathname: '/signer/lightning/pay',
        params: {
          invoice: content.cleaned,
          type: content.type
        }
      })
      break
  }
}

/**
 * Process ecash content (tokens, lightning invoices)
 */
function processEcashContent(
  content: DetectedContent,
  actions: ProcessorActions
) {
  const { navigate } = actions

  switch (content.type) {
    case 'ecash_token':
      // For ecash tokens, we'll let the ecash store handle the processing
      // The parent component should handle the token processing
      navigate({
        pathname: '/signer/ecash/receive',
        params: { token: content.cleaned }
      })
      break

    case 'lightning_invoice':
    case 'lnurl':
      // Lightning invoices in ecash context go to ecash send
      navigate({
        pathname: '/signer/ecash/send',
        params: {
          invoice: content.cleaned,
          type: content.type
        }
      })
      break
  }
}

export async function processContentByContext(
  content: DetectedContent,
  context: 'bitcoin' | 'lightning' | 'ecash',
  actions: ProcessorActions,
  accountId?: string,
  account?: Account
): Promise<void> {
  if (!content.isValid) {
    throw new Error(t('error.invalidContentCannotBeProcessed'))
  }

  switch (context) {
    case 'bitcoin':
      if (!accountId) {
        throw new Error(t('error.accountIdRequired'))
      }
      await processBitcoinContent(content, actions, accountId, account)
      break

    case 'lightning':
      processLightningContent(content, actions)
      break

    case 'ecash':
      processEcashContent(content, actions)
      break

    default:
      throw new Error(t('error.unsupportedContext', { context }))
  }
}

export function processContentForOutput(
  content: DetectedContent,
  actions: {
    setOutputTo: (address: string) => void
    setOutputAmount: (amount: number) => void
    setOutputLabel: (label: string) => void
    onError: (message: string) => void
    onWarning: (message: string) => void
    remainingSats?: number
  }
): boolean {
  if (!content.isValid) {
    actions.onError(t('error.invalidContent'))
    return false
  }

  if (content.type === 'psbt') {
    actions.onError(t('error.psbtCannotBeUsedForOutputs'))
    return false
  }

  if (content.type === 'bitcoin_address') {
    actions.setOutputTo(content.cleaned)
    actions.setOutputAmount(1)
    actions.setOutputLabel('')
    return true
  }

  if (content.type === 'bitcoin_uri') {
    try {
      const decodedData = bip21decode(content.cleaned)
      if (decodedData && typeof decodedData === 'object') {
        actions.setOutputTo(decodedData.address)

        const amount = (decodedData.options.amount || 0) * SATS_PER_BITCOIN || 1
        if (amount > 1) {
          if (actions.remainingSats && amount > actions.remainingSats) {
            actions.onWarning(t('error.insufficientFundsForAmount'))
          } else {
            actions.setOutputAmount(amount)
          }
        } else {
          actions.setOutputAmount(1)
        }

        actions.setOutputLabel(decodedData.options.label || '')
        return true
      }
    } catch {
      actions.onError(t('error.failedToDecodeBitcoinUri'))
      return false
    }
  }

  actions.onError(t('error.noValidAddressFound'))
  return false
}
