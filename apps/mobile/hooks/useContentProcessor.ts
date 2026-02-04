import { type PartiallySignedTransaction } from 'bdk-rn'
import {
  type TransactionDetails,
  type TxBuilderResult
} from 'bdk-rn/lib/classes/Bindings'
import * as bitcoinjs from 'bitcoinjs-lib'
import { Buffer } from 'buffer'

import { SATS_PER_BITCOIN } from '@/constants/btc'
import { t } from '@/locales'
import { type Account } from '@/types/models/Account'
import { type Utxo } from '@/types/models/Utxo'
import { extractKeyFingerprint } from '@/utils/account'
import { parseBitcoinUri } from '@/utils/bip321'
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

function autoSelectUtxos(
  account: Account,
  targetAmount: number,
  actions: Pick<ProcessorActions, 'addInput' | 'setFeeRate'>
) {
  if (!account || account.utxos.length === 0) return

  const { addInput, setFeeRate } = actions

  if (setFeeRate && typeof setFeeRate === 'function') {
    setFeeRate(1)
  }

  if (targetAmount === 0 || targetAmount === 1) {
    const highestUtxo = account.utxos.reduce((max: Utxo, utxo: Utxo) =>
      utxo.value > max.value ? utxo : max
    )
    addInput?.(highestUtxo)
    return
  }

  const result = selectEfficientUtxos(account.utxos, targetAmount, 1, {
    dustThreshold: 546,
    inputSize: 148,
    changeOutputSize: 34
  })

  if (result.error) {
    const highestUtxo = account.utxos.reduce((max: Utxo, utxo: Utxo) =>
      utxo.value > max.value ? utxo : max
    )
    addInput?.(highestUtxo)
  } else {
    result.inputs.forEach((utxo) => addInput?.(utxo))
  }
}

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
    case 'psbt': {
      let psbtBase64 = content.cleaned
      if (/^[0-9a-fA-F]+$/.test(content.cleaned.trim())) {
        psbtBase64 = Buffer.from(content.cleaned, 'hex').toString('base64')
      }

      const psbtParam = encodeURIComponent(psbtBase64)
      navigate(
        `/signer/bitcoin/account/${accountId}/signAndSend/previewTransaction?psbt=${psbtParam}`
      )

      if (account) {
        const accountMatch = await findMatchingAccount(psbtBase64, [account])

        if (accountMatch) {
          const originalPsbt = extractOriginalPsbt(psbtBase64)

          const extractedData = extractTransactionDataFromPSBTEnhanced(
            originalPsbt,
            account
          )

          if (extractedData) {
            const inputs = extractedData?.inputs || []
            const outputs = extractedData?.outputs || []
            const fee = extractedData?.fee || 0

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
                  if (pubkey) {
                    const cosignerIndex = pubkeyToCosignerIndex.get(pubkey)
                    if (cosignerIndex !== undefined) {
                      if (!psbtsByCosigner.has(cosignerIndex)) {
                        psbtsByCosigner.set(cosignerIndex, [])
                      }
                      psbtsByCosigner.get(cosignerIndex)!.push(psbtStr)
                    }
                  }
                }
              })

              for (const [cosignerIndex, psbts] of psbtsByCosigner.entries()) {
                if (psbts.length > 1) {
                  const combined = combinePsbts(psbts)
                  finalSignedPsbtsMap.set(cosignerIndex, combined)
                } else {
                  finalSignedPsbtsMap.set(cosignerIndex, psbts[0])
                }
              }
            } else {
              const individualSignedPsbts = extractIndividualSignedPsbts(
                psbtBase64,
                originalPsbt
              )
              Object.entries(individualSignedPsbts).forEach(([key, value]) => {
                finalSignedPsbtsMap.set(parseInt(key, 10), value as string)
              })
            }
            actions.setSignedPsbts?.(finalSignedPsbtsMap)

            const extractedTxid = extractTransactionIdFromPSBT(originalPsbt)
            if (!extractedTxid) {
              return
            }

            const sent = outputs.reduce(
              (acc: number, output) => acc + output.value,
              0
            )
            const received = inputs.reduce(
              (acc: number, input) => acc + (input.value || 0),
              0
            )

            const psbt: PartiallySignedTransaction = { originalPsbt } as any

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
      }

      break
    }

    case 'bitcoin_descriptor':
      actions.navigate(
        `/signer/bitcoin/account/add/watchOnly?descriptor=${content.cleaned}`
      )
      break

    case 'extended_public_key':
      actions.navigate(
        `/signer/bitcoin/account/add/watchOnly?extendedPublicKey=${encodeURIComponent(
          content.cleaned
        )}`
      )
      break

    case 'bitcoin_transaction':
      navigate({
        pathname: '/signer/bitcoin/account/[id]/signAndSend/previewTransaction',
        params: { id: accountId, signedPsbt: content.cleaned }
      })
      break

    case 'bitcoin_uri': {
      try {
        let uriToDecode = content.cleaned
        if (!uriToDecode.toLowerCase().startsWith('bitcoin:')) {
          uriToDecode = `bitcoin:${uriToDecode}`
        }

        const parsed = parseBitcoinUri(uriToDecode)
        if (parsed.isValid && parsed.address) {
          const amount =
            (parsed.amount || 0) * SATS_PER_BITCOIN || 1

          if (account && account.summary && amount > account.summary.balance) {
            return
          }

          if (addOutput) {
            addOutput({
              amount,
              label: parsed.label || '',
              to: parsed.address
            })
          }

          if (account && addOutput) {
            autoSelectUtxos(account, amount, actions)
          }

          navigate({
            pathname: '/signer/bitcoin/account/[id]/signAndSend/ioPreview',
            params: { id: accountId }
          })
        } else {
          const addressMatch = content.cleaned.match(
            /^([a-zA-Z0-9]{26,62})(\?.*)?$/
          )
          if (addressMatch) {
            const address = addressMatch[1]
            const queryString = addressMatch[2] || ''

            let amount = 1
            let label = ''

            if (queryString) {
              const params = new URLSearchParams(queryString.substring(1))
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

            if (
              account &&
              account.summary &&
              amount > account.summary.balance
            ) {
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
              pathname: '/signer/bitcoin/account/[id]/signAndSend/ioPreview',
              params: { id: accountId }
            })
          }
        }
      } catch {
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
          pathname: '/signer/bitcoin/account/[id]/signAndSend/ioPreview',
          params: { id: accountId }
        })
      }
      break
    }

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
        pathname: '/signer/bitcoin/account/[id]/signAndSend/ioPreview',
        params: { id: accountId }
      })
      break
  }
}

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

function processEcashContent(
  content: DetectedContent,
  actions: ProcessorActions
) {
  const { navigate } = actions

  switch (content.type) {
    case 'ecash_token':
      navigate({
        pathname: '/signer/ecash/receive',
        params: { token: content.cleaned }
      })
      break

    case 'lightning_invoice':
    case 'lnurl':
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
) {
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
      let uriToDecode = content.cleaned
      if (!uriToDecode.toLowerCase().startsWith('bitcoin:')) {
        uriToDecode = `bitcoin:${uriToDecode}`
      }

      const parsed = parseBitcoinUri(uriToDecode)
      if (parsed.isValid && parsed.address) {
        actions.setOutputTo(parsed.address)

        if (parsed.amount !== undefined) {
          const amountInBTC = Number(parsed.amount)
          if (!isNaN(amountInBTC) && amountInBTC > 0) {
            const amountInSats = Math.round(amountInBTC * SATS_PER_BITCOIN)
            if (actions.remainingSats && amountInSats > actions.remainingSats) {
              actions.onWarning(t('error.insufficientFundsForAmount'))
            } else {
              actions.setOutputAmount(amountInSats)
            }
          } else {
            actions.setOutputAmount(1)
          }
        } else {
          actions.setOutputAmount(1)
        }

        actions.setOutputLabel(parsed.label || '')
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
