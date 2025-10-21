import { SATS_PER_BITCOIN } from '@/constants/btc'
import { type Account } from '@/types/models/Account'
import { type Utxo } from '@/types/models/Utxo'
import { bip21decode } from '@/utils/bitcoin'
import { type DetectedContent } from '@/utils/contentDetector'
import { selectEfficientUtxos } from '@/utils/utxo'

export type ProcessorActions = {
  navigate: (
    path: string | { pathname: string; params?: Record<string, unknown> }
  ) => void
  clearTransaction?: () => void
  addOutput?: (output: { amount: number; label: string; to: string }) => void
  addInput?: (input: Utxo) => void
  setFeeRate?: (rate: number) => void
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
function processBitcoinContent(
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
      navigate({
        pathname: '/account/[id]/signAndSend/previewMessage',
        params: { id: accountId, psbt: content.cleaned }
      })
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
          if (addOutput) {
            addOutput({
              amount: (decodedData.options.amount || 0) * SATS_PER_BITCOIN || 1,
              label: decodedData.options.label || '',
              to: decodedData.address
            })
          }

          // Auto-select UTXOs if account is available
          if (account && addOutput) {
            autoSelectUtxos(
              account,
              (decodedData.options.amount || 0) * SATS_PER_BITCOIN || 1,
              actions
            )
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

export function processContentByContext(
  content: DetectedContent,
  context: 'bitcoin' | 'lightning' | 'ecash',
  actions: ProcessorActions,
  accountId?: string,
  account?: Account
): void {
  if (!content.isValid) {
    throw new Error('Invalid content cannot be processed')
  }

  switch (context) {
    case 'bitcoin':
      if (!accountId) {
        throw new Error('Account ID is required for Bitcoin context')
      }
      processBitcoinContent(content, actions, accountId, account)
      break

    case 'lightning':
      processLightningContent(content, actions)
      break

    case 'ecash':
      processEcashContent(content, actions)
      break

    default:
      throw new Error(`Unsupported context: ${context}`)
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
    actions.onError('Invalid content')
    return false
  }

  if (content.type === 'psbt') {
    actions.onError('PSBTs cannot be used for individual outputs')
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
            actions.onWarning('Insufficient funds for the specified amount')
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
      actions.onError('Failed to decode Bitcoin URI')
      return false
    }
  }

  actions.onError('No valid address found in content')
  return false
}
