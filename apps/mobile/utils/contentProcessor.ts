import { Buffer } from 'buffer'

import * as bitcoinjs from 'bitcoinjs-lib'
import { type Href } from 'expo-router'
import { type PsbtLike } from 'react-native-bdk-sdk'

import { AUTO_SELECT_FROM_URI_SEARCH_PARAM } from '@/constants/autoSelectUtxos'
import { DUST_LIMIT } from '@/constants/btc'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { type Account } from '@/types/models/Account'
import { type Utxo } from '@/types/models/Utxo'
import { getKeyFingerprint } from '@/utils/account'
import {
  bitcoinAmountBtcToSats,
  isUriPaymentAmount
} from '@/utils/autoSelectUtxos'
import { parseBitcoinPaymentUri } from '@/utils/bip321'
import {
  type ContentContext,
  type DetectedContent,
  prepareEcashTokenInput
} from '@/utils/contentDetector'
import { getUsableFeeRate } from '@/utils/feeWarnings'
import { ensureBitcoinPrefix, parseUriParameters } from '@/utils/parse'
import { hasPayjoinParam } from '@/utils/payjoinUri'
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
import { applyUtxoDenylist } from '@/utils/utxoList'

export type BitcoinUriExceedsBalancePromptInfo = {
  address: string
  availableBalanceSats: number
  label: string
  requestedAmountSats: number
}

type ProcessorActions = {
  navigate: (path: Href) => void
  clearTransaction?: () => void
  setAccountId?: (accountId: string) => void
  addOutput?: (output: { amount: number; label: string; to: string }) => void
  addInput?: (input: Utxo) => void
  setFeeRate?: (rate: number) => void
  setRbf?: (enabled: boolean) => void
  setSignedPsbts?: (psbts: Map<number, string>) => void
  setPsbt?: (psbt: PsbtLike) => void
  setPayjoinUri?: (uri: string | undefined) => void
  promptBitcoinUriExceedsBalance?: (
    info: BitcoinUriExceedsBalancePromptInfo
  ) => Promise<'cancel' | 'without_amount'>
}

/** Bare `address?query` fallback when BIP21 parsing rejects the content. */
const BARE_ADDRESS_PATTERN = /^[a-zA-Z0-9]{26,62}$/
/** Placeholder amount meaning "user fills it in" on ioPreview. */
const UNSET_AMOUNT_SATS = 1
const IO_PREVIEW_PATHNAME = '/signer/bitcoin/account/[id]/signAndSend/ioPreview'
const PREVIEW_TRANSACTION_PATHNAME =
  '/signer/bitcoin/account/[id]/signAndSend/previewTransaction'

/**
 * Returns the `bitcoin:` Payjoin URI carried by scanned content, if any.
 * Prefers raw (may still have `bitcoin:`), then cleaned (prefix stripped).
 */
export function extractPayjoinUriFromContent(
  content: DetectedContent
): string | undefined {
  return [content.raw, content.cleaned]
    .filter((candidate) => candidate?.trim())
    .map(ensureBitcoinPrefix)
    .find(hasPayjoinParam)
}

function btcToSatsOrUnset(amountBtc: number | undefined): number {
  return bitcoinAmountBtcToSats(amountBtc ?? 0) || UNSET_AMOUNT_SATS
}

function highestValueUtxo(utxos: Utxo[]): Utxo {
  return utxos.reduce((max, utxo) => (utxo.value > max.value ? utxo : max))
}

function navigateToIoPreview(
  actions: ProcessorActions,
  accountId: string,
  params: { autoSelectFromUri?: string; dustWarning?: string } = {}
) {
  actions.navigate({
    params: { ...params, id: accountId },
    pathname: IO_PREVIEW_PATHNAME
  })
}

/** Adds `address` as an output without amount and opens ioPreview. */
function commitAddressOnly(
  actions: ProcessorActions,
  accountId: string,
  address: string,
  account?: Account
) {
  actions.addOutput?.({ amount: UNSET_AMOUNT_SATS, label: '', to: address })
  if (account) {
    autoSelectUtxos(account, UNSET_AMOUNT_SATS, actions)
  }
  navigateToIoPreview(actions, accountId)
}

export function autoSelectUtxos(
  account: Account,
  targetAmount: number,
  actions: Pick<ProcessorActions, 'addInput' | 'setFeeRate'>
) {
  const selectableUtxos = applyUtxoDenylist(
    account.utxos,
    account.excludedUtxoOutpoints ?? []
  )
  if (selectableUtxos.length === 0) {
    return
  }

  const { addInput, setFeeRate } = actions
  // Match ioPreview fee hydration — selecting at 1 sat/vB then bumping the
  // rate left Payjoin invoices underfunded until the user added inputs.
  const feeRate =
    getUsableFeeRate(useBlockchainStore.getState().nextBlockFee) ?? 1
  setFeeRate?.(feeRate)

  if (targetAmount === 0 || targetAmount === UNSET_AMOUNT_SATS) {
    addInput?.(highestValueUtxo(selectableUtxos))
    return
  }

  const result = selectEfficientUtxos(selectableUtxos, targetAmount, feeRate, {
    dustThreshold: DUST_LIMIT
  })
  const inputs = result.error
    ? [highestValueUtxo(selectableUtxos)]
    : result.inputs
  for (const utxo of inputs) {
    addInput?.(utxo)
  }
}

export function commitBitcoinUriToIoPreview(
  actions: ProcessorActions,
  accountId: string,
  account: Account | undefined,
  address: string,
  label: string,
  amountSats: number,
  payjoinUri?: string
) {
  actions.addOutput?.({ amount: amountSats, label, to: address })
  if (payjoinUri) {
    actions.setPayjoinUri?.(payjoinUri)
  }

  // Payment amounts defer fee-aware selection to ioPreview (uses
  // nextBlockFee): pre-selecting at 1 sat/vB caused "Amount exceed max…"
  // after fee hydration. Payjoin always uses efficiency, never STONEWALL.
  const deferFeeAwareSelect = isUriPaymentAmount(amountSats)
  if (!deferFeeAwareSelect && account) {
    autoSelectUtxos(account, amountSats, actions)
  }
  navigateToIoPreview(actions, accountId, {
    autoSelectFromUri: deferFeeAwareSelect
      ? AUTO_SELECT_FROM_URI_SEARCH_PARAM
      : undefined
  })
}

/** Maps every signed PSBT inside `psbtBase64` to its cosigner index. */
async function collectSignedPsbtsByCosigner(
  account: Account,
  psbtBase64: string,
  originalPsbt: string
): Promise<Map<number, string>> {
  const individualSignedPsbts = extractIndividualSignedPsbts(
    psbtBase64,
    originalPsbt
  )
  const signedPsbts = new Map<number, string>()

  if (account.policyType !== 'multisig') {
    for (const [key, value] of Object.entries(individualSignedPsbts)) {
      signedPsbts.set(parseInt(key, 10), value)
    }
    return signedPsbts
  }

  const keyFingerprintToCosignerIndex = new Map<string, number>()
  await Promise.all(
    account.keys.map(async (key, index) => {
      const fp = await getKeyFingerprint(key)
      if (fp) {
        keyFingerprintToCosignerIndex.set(fp, index)
      }
    })
  )

  const pubkeyToCosignerIndex = new Map<string, number>()
  const combinedPsbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
  for (const input of combinedPsbt.data.inputs) {
    for (const derivation of input.bip32Derivation ?? []) {
      const cosignerIndex = keyFingerprintToCosignerIndex.get(
        derivation.masterFingerprint.toString('hex')
      )
      if (cosignerIndex !== undefined) {
        pubkeyToCosignerIndex.set(
          derivation.pubkey.toString('hex'),
          cosignerIndex
        )
      }
    }
  }

  const psbtsByCosigner = new Map<number, string[]>()
  for (const psbtStr of Object.values(individualSignedPsbts)) {
    const pubkey = getCollectedSignerPubkeys(psbtStr).values().next().value
    const cosignerIndex = pubkey ? pubkeyToCosignerIndex.get(pubkey) : undefined
    if (cosignerIndex === undefined) {
      continue
    }
    psbtsByCosigner.set(cosignerIndex, [
      ...(psbtsByCosigner.get(cosignerIndex) ?? []),
      psbtStr
    ])
  }

  for (const [cosignerIndex, psbts] of psbtsByCosigner.entries()) {
    signedPsbts.set(
      cosignerIndex,
      psbts.length > 1 ? combinePsbts(psbts) : psbts[0]
    )
  }
  return signedPsbts
}

/** Loads the signatures of a scanned PSBT that belongs to `account`. */
async function loadScannedPsbt(
  psbtBase64: string,
  actions: ProcessorActions,
  account: Account
) {
  const accountMatch = await findMatchingAccount(psbtBase64, [account])
  if (!accountMatch) {
    return
  }

  const originalPsbt = extractOriginalPsbt(psbtBase64)
  const extractedData = extractTransactionDataFromPSBTEnhanced(
    originalPsbt,
    account
  )
  if (!extractedData) {
    return
  }

  actions.setRbf?.(true)
  actions.setSignedPsbts?.(
    await collectSignedPsbtsByCosigner(
      accountMatch.account,
      psbtBase64,
      originalPsbt
    )
  )

  const extractedTxid = extractTransactionIdFromPSBT(originalPsbt)
  if (!extractedTxid) {
    return
  }

  const mockPsbt = {
    extractTxHex: () => '',
    feeAmount: () => extractedData.fee || 0,
    toBase64: () => originalPsbt,
    txid: () => extractedTxid
  } as unknown as PsbtLike
  actions.setPsbt?.(mockPsbt)
}

/**
 * Adds a scanned payment request as an output: dust amounts open ioPreview
 * with a warning, amounts above the balance ask the user first.
 */
async function commitOrPromptBitcoinUri(
  actions: ProcessorActions,
  accountId: string,
  account: Account | undefined,
  request: { address: string; label: string; amountSats: number },
  payjoinUri?: string
) {
  const { address, label, amountSats } = request

  if (amountSats > UNSET_AMOUNT_SATS && amountSats < DUST_LIMIT) {
    actions.addOutput?.({ amount: amountSats, label, to: address })
    if (payjoinUri) {
      actions.setPayjoinUri?.(payjoinUri)
    }
    if (account) {
      autoSelectUtxos(account, amountSats, actions)
    }
    navigateToIoPreview(actions, accountId, { dustWarning: '1' })
    return
  }

  const balance = account?.summary?.balance
  if (balance !== undefined && amountSats > balance) {
    if (!actions.promptBitcoinUriExceedsBalance) {
      return
    }
    const choice = await actions.promptBitcoinUriExceedsBalance({
      address,
      availableBalanceSats: balance,
      label,
      requestedAmountSats: amountSats
    })
    if (choice === 'cancel') {
      return
    }
    commitBitcoinUriToIoPreview(
      actions,
      accountId,
      account,
      address,
      label,
      UNSET_AMOUNT_SATS,
      payjoinUri
    )
    return
  }

  commitBitcoinUriToIoPreview(
    actions,
    accountId,
    account,
    address,
    label,
    amountSats,
    payjoinUri
  )
}

/** BIP21/Payjoin URI, or a bare `address?amount=` the BIP21 parser rejects. */
function parseScannedPaymentUri(content: DetectedContent, payjoinUri?: string) {
  const bare = parseUriParameters(content.cleaned)
  const parsed =
    parseBitcoinPaymentUri(payjoinUri ?? content.cleaned) ??
    (bare && BARE_ADDRESS_PATTERN.test(bare.address) ? bare : null)
  if (!parsed) {
    return null
  }
  return {
    address: parsed.address,
    amountSats: btcToSatsOrUnset(parsed.amount),
    label: parsed.label ?? ''
  }
}

async function processBitcoinUri(
  content: DetectedContent,
  actions: ProcessorActions,
  accountId: string,
  account?: Account
) {
  try {
    const payjoinUri = extractPayjoinUriFromContent(content)
    const request = parseScannedPaymentUri(content, payjoinUri)
    if (request) {
      await commitOrPromptBitcoinUri(
        actions,
        accountId,
        account,
        request,
        payjoinUri
      )
    }
  } catch {
    commitAddressOnly(actions, accountId, content.cleaned, account)
  }
}

/**
 * Applies scanned bitcoin content to the transaction builder of `accountId`
 * and navigates to the screen that handles it.
 */
export async function processBitcoinContent(
  content: DetectedContent,
  actions: ProcessorActions,
  accountId: string,
  account?: Account
): Promise<void> {
  if (!content.isValid) {
    throw new Error(t('error.invalidContentCannotBeProcessed'))
  }

  actions.clearTransaction?.()
  actions.setAccountId?.(accountId)

  switch (content.type) {
    case 'psbt': {
      const psbtBase64 = /^[0-9a-fA-F]+$/.test(content.cleaned.trim())
        ? Buffer.from(content.cleaned, 'hex').toString('base64')
        : content.cleaned
      actions.navigate({
        params: { id: accountId, psbt: psbtBase64 },
        pathname: PREVIEW_TRANSACTION_PATHNAME
      })
      if (account) {
        await loadScannedPsbt(psbtBase64, actions, account)
      }
      break
    }
    case 'bitcoin_descriptor':
      actions.navigate({
        params: { descriptor: content.cleaned },
        pathname: '/signer/bitcoin/account/add/watchOnly'
      })
      break
    case 'extended_public_key':
      actions.navigate({
        params: { extendedPublicKey: content.cleaned },
        pathname: '/signer/bitcoin/account/add/watchOnly'
      })
      break
    case 'bitcoin_transaction':
      actions.navigate({
        params: { id: accountId, signedPsbt: content.cleaned },
        pathname: PREVIEW_TRANSACTION_PATHNAME
      })
      break
    case 'bitcoin_uri':
      await processBitcoinUri(content, actions, accountId, account)
      break
    case 'bitcoin_address':
      commitAddressOnly(actions, accountId, content.cleaned, account)
      break
    default:
      break
  }
}

/** Screen that handles scanned lightning/ecash content, or null if none. */
export function getContentHref(
  content: DetectedContent,
  context: ContentContext
): Href | null {
  const isInvoice =
    content.type === 'lightning_invoice' || content.type === 'lnurl'

  if (context === 'lightning' && isInvoice) {
    return {
      params: { invoice: content.cleaned, type: content.type },
      pathname: '/signer/lightning/pay'
    }
  }
  if (context === 'ecash' && isInvoice) {
    return {
      params: { invoice: content.cleaned, type: content.type },
      pathname: '/signer/ecash/send'
    }
  }
  if (context === 'ecash' && content.type === 'ecash_token') {
    return {
      params: { token: prepareEcashTokenInput(content.cleaned) },
      pathname: '/signer/ecash/receive'
    }
  }
  return null
}

type OutputActions = {
  setOutputTo: (address: string) => void
  setOutputAmount: (amount: number) => void
  setOutputLabel: (label: string) => void
  setPayjoinUri?: (uri: string | undefined) => void
  onError: (message: string) => void
  onWarning: (message: string) => void
  remainingSats?: number
}

type OutputResult = { ok: boolean; payjoin: boolean }

/** Fills a single output form from pasted/scanned content. */
export function processContentForOutput(
  content: DetectedContent,
  actions: OutputActions
): OutputResult {
  if (!content.isValid) {
    actions.onError(t('error.invalidContent'))
    return { ok: false, payjoin: false }
  }

  if (content.type === 'psbt') {
    actions.onError(t('error.psbtCannotBeUsedForOutputs'))
    return { ok: false, payjoin: false }
  }

  if (content.type === 'bitcoin_address') {
    actions.setOutputTo(content.cleaned)
    actions.setOutputAmount(UNSET_AMOUNT_SATS)
    actions.setOutputLabel('')
    actions.setPayjoinUri?.(undefined)
    return { ok: true, payjoin: false }
  }

  if (content.type !== 'bitcoin_uri') {
    actions.onError(t('error.noValidAddressFound'))
    return { ok: false, payjoin: false }
  }

  try {
    return applyPaymentUriToOutput(content, actions)
  } catch {
    actions.onError(t('error.failedToDecodeBitcoinUri'))
    return { ok: false, payjoin: false }
  }
}

function applyPaymentUriToOutput(
  content: DetectedContent,
  actions: OutputActions
): OutputResult {
  const payjoinUri = extractPayjoinUriFromContent(content)
  const parsed = parseBitcoinPaymentUri(payjoinUri ?? content.cleaned)
  if (!parsed) {
    actions.onError(t('error.noValidAddressFound'))
    return { ok: false, payjoin: false }
  }

  const payjoin = payjoinUri !== undefined
  const amountSats =
    parsed.amount !== undefined && parsed.amount > 0
      ? bitcoinAmountBtcToSats(parsed.amount)
      : 0

  actions.setOutputTo(parsed.address)
  if (amountSats > 0 && amountSats < DUST_LIMIT) {
    actions.onError(t('transaction.error.dustOutputBelowLimit'))
    return { ok: false, payjoin }
  }
  if (amountSats === 0) {
    actions.setOutputAmount(UNSET_AMOUNT_SATS)
  } else if (actions.remainingSats && amountSats > actions.remainingSats) {
    actions.onWarning(t('error.insufficientFundsForAmount'))
  } else {
    actions.setOutputAmount(amountSats)
  }
  actions.setOutputLabel(parsed.label ?? '')
  actions.setPayjoinUri?.(payjoinUri)
  return { ok: true, payjoin }
}
