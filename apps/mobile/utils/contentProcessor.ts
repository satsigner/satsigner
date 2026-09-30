import { Buffer } from 'buffer'

import * as bitcoinjs from 'bitcoinjs-lib'
import { type Href } from 'expo-router'
import { type PsbtLike } from 'react-native-bdk-sdk'

import { AUTO_SELECT_FROM_URI_SEARCH_PARAM } from '@/constants/autoSelectUtxos'
import {
  BARE_BITCOIN_ADDRESS_PATTERN,
  DUST_LIMIT,
  HEX_PATTERN,
  UNSET_OUTPUT_AMOUNT_SATS
} from '@/constants/btc'
import { t } from '@/locales'
import { type Account } from '@/types/models/Account'
import { type Utxo } from '@/types/models/Utxo'
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
  getCollectedSignerPubkeys,
  type KeyFingerprintsByAccount
} from '@/utils/psbt'
import { selectEfficientUtxos } from '@/utils/utxo'
import { applyUtxoDenylist } from '@/utils/utxoList'

export type BitcoinUriExceedsBalancePromptInfo = {
  address: string
  availableBalanceSats: number
  label: string
  requestedAmountSats: number
}

export type BitcoinContentActions = {
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

export type BitcoinContentTarget = {
  accountId: string
  account?: Account
  nextBlockFee: number | null
}

export type PaymentRequest = {
  address: string
  label: string
  amountSats: number
}

type IoPreviewParams = {
  autoSelectFromUri?: string
  dustWarning?: string
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

type OutputResult = {
  ok: boolean
  payjoin: boolean
}

/** Prefers raw (may still have `bitcoin:`), then cleaned (prefix stripped). */
export function extractPayjoinUriFromContent(
  content: DetectedContent
): string | undefined {
  return [content.raw, content.cleaned]
    .filter((candidate) => candidate?.trim())
    .map(ensureBitcoinPrefix)
    .find(hasPayjoinParam)
}

function highestValueUtxo(utxos: Utxo[]): Utxo {
  return utxos.reduce((max, utxo) => (utxo.value > max.value ? utxo : max))
}

export function autoSelectUtxos(
  account: Account,
  targetAmount: number,
  nextBlockFee: number | null,
  actions: Pick<BitcoinContentActions, 'addInput' | 'setFeeRate'>
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
  const feeRate = getUsableFeeRate(nextBlockFee) ?? 1
  setFeeRate?.(feeRate)

  if (targetAmount === 0 || targetAmount === UNSET_OUTPUT_AMOUNT_SATS) {
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

function navigateToIoPreview(
  actions: BitcoinContentActions,
  accountId: string,
  params: IoPreviewParams = {}
) {
  actions.navigate({
    params: { ...params, id: accountId },
    pathname: '/signer/bitcoin/account/[id]/signAndSend/ioPreview'
  })
}

function selectUtxosForAmount(
  actions: BitcoinContentActions,
  target: BitcoinContentTarget,
  amountSats: number
) {
  if (!target.account) {
    return
  }
  autoSelectUtxos(target.account, amountSats, target.nextBlockFee, actions)
}

export function commitAddressOnly(
  actions: BitcoinContentActions,
  target: BitcoinContentTarget,
  address: string
) {
  actions.addOutput?.({
    amount: UNSET_OUTPUT_AMOUNT_SATS,
    label: '',
    to: address
  })
  selectUtxosForAmount(actions, target, UNSET_OUTPUT_AMOUNT_SATS)
  navigateToIoPreview(actions, target.accountId)
}

export function isDustPaymentAmount(amountSats: number): boolean {
  return amountSats > UNSET_OUTPUT_AMOUNT_SATS && amountSats < DUST_LIMIT
}

export function commitDustBitcoinUri(
  actions: BitcoinContentActions,
  target: BitcoinContentTarget,
  { address, label, amountSats }: PaymentRequest,
  payjoinUri?: string
) {
  actions.addOutput?.({ amount: amountSats, label, to: address })
  if (payjoinUri) {
    actions.setPayjoinUri?.(payjoinUri)
  }
  selectUtxosForAmount(actions, target, amountSats)
  navigateToIoPreview(actions, target.accountId, { dustWarning: '1' })
}

export function commitBitcoinUriToIoPreview(
  actions: BitcoinContentActions,
  target: BitcoinContentTarget,
  { address, label, amountSats }: PaymentRequest,
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
  if (!deferFeeAwareSelect) {
    selectUtxosForAmount(actions, target, amountSats)
  }
  navigateToIoPreview(actions, target.accountId, {
    autoSelectFromUri: deferFeeAwareSelect
      ? AUTO_SELECT_FROM_URI_SEARCH_PARAM
      : undefined
  })
}

export function parseScannedPaymentUri(
  content: DetectedContent,
  payjoinUri?: string
): PaymentRequest | null {
  const bare = parseUriParameters(content.cleaned)
  const parsed =
    parseBitcoinPaymentUri(payjoinUri ?? content.cleaned) ??
    (bare && BARE_BITCOIN_ADDRESS_PATTERN.test(bare.address) ? bare : null)
  if (!parsed) {
    return null
  }
  return {
    address: parsed.address,
    amountSats:
      bitcoinAmountBtcToSats(parsed.amount ?? 0) || UNSET_OUTPUT_AMOUNT_SATS,
    label: parsed.label ?? ''
  }
}

export function psbtContentToBase64(cleaned: string): string {
  return HEX_PATTERN.test(cleaned.trim())
    ? Buffer.from(cleaned, 'hex').toString('base64')
    : cleaned
}

export function getBitcoinContentHref(
  content: DetectedContent,
  accountId: string
): Href | null {
  switch (content.type) {
    case 'psbt':
      return {
        params: { id: accountId, psbt: psbtContentToBase64(content.cleaned) },
        pathname: '/signer/bitcoin/account/[id]/signAndSend/previewTransaction'
      }
    case 'bitcoin_transaction':
      return {
        params: { id: accountId, signedPsbt: content.cleaned },
        pathname: '/signer/bitcoin/account/[id]/signAndSend/previewTransaction'
      }
    case 'bitcoin_descriptor':
      return {
        params: { descriptor: content.cleaned },
        pathname: '/signer/bitcoin/account/add/watchOnly'
      }
    case 'extended_public_key':
      return {
        params: { extendedPublicKey: content.cleaned },
        pathname: '/signer/bitcoin/account/add/watchOnly'
      }
    default:
      return null
  }
}

export function indexSignedPsbts(
  individualSignedPsbts: Record<number, string>
): Map<number, string> {
  return new Map(
    Object.entries(individualSignedPsbts).map(
      ([key, value]): [number, string] => [Number(key), value]
    )
  )
}

export function mapSignedPsbtsToCosigners(
  individualSignedPsbts: Record<number, string>,
  psbtBase64: string,
  keyFingerprints: string[]
): Map<number, string> {
  const pubkeyToCosignerIndex = new Map<string, number>()
  const combinedPsbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
  for (const input of combinedPsbt.data.inputs) {
    for (const derivation of input.bip32Derivation ?? []) {
      const cosignerIndex = keyFingerprints.indexOf(
        derivation.masterFingerprint.toString('hex')
      )
      if (cosignerIndex !== -1) {
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

  const signedPsbts = new Map<number, string>()
  for (const [cosignerIndex, psbts] of psbtsByCosigner.entries()) {
    signedPsbts.set(
      cosignerIndex,
      psbts.length > 1 ? combinePsbts(psbts) : psbts[0]
    )
  }
  return signedPsbts
}

export function applyScannedPsbt(
  psbtBase64: string,
  actions: BitcoinContentActions,
  account: Account,
  keyFingerprintsByAccount: KeyFingerprintsByAccount
): string | null {
  const accountMatch = findMatchingAccount(
    psbtBase64,
    [account],
    keyFingerprintsByAccount
  )
  if (!accountMatch) {
    return null
  }

  const originalPsbt = extractOriginalPsbt(psbtBase64)
  if (!extractTransactionDataFromPSBTEnhanced(originalPsbt, account)) {
    return null
  }

  const matchedAccount = accountMatch.account
  const individualSignedPsbts = extractIndividualSignedPsbts(
    psbtBase64,
    originalPsbt
  )
  actions.setRbf?.(true)
  actions.setSignedPsbts?.(
    matchedAccount.policyType === 'multisig'
      ? mapSignedPsbtsToCosigners(
          individualSignedPsbts,
          psbtBase64,
          keyFingerprintsByAccount[matchedAccount.id] ?? []
        )
      : indexSignedPsbts(individualSignedPsbts)
  )
  return extractTransactionIdFromPSBT(originalPsbt) ? originalPsbt : null
}

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

function applyPaymentUriToOutput(
  content: DetectedContent,
  actions: OutputActions
): OutputResult {
  const payjoinUri = extractPayjoinUriFromContent(content)
  const parsed = parseBitcoinPaymentUri(payjoinUri ?? content.cleaned)
  if (!parsed) {
    actions.onError(t('transaction.error.noValidAddressFound'))
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
    actions.setOutputAmount(UNSET_OUTPUT_AMOUNT_SATS)
  } else if (actions.remainingSats && amountSats > actions.remainingSats) {
    actions.onWarning(t('transaction.error.insufficientFundsForAmount'))
  } else {
    actions.setOutputAmount(amountSats)
  }
  actions.setOutputLabel(parsed.label ?? '')
  actions.setPayjoinUri?.(payjoinUri)
  return { ok: true, payjoin }
}

export function processContentForOutput(
  content: DetectedContent,
  actions: OutputActions
): OutputResult {
  if (!content.isValid) {
    actions.onError(t('transaction.error.invalidContent'))
    return { ok: false, payjoin: false }
  }

  if (content.type === 'psbt') {
    actions.onError(t('transaction.error.psbtCannotBeUsedForOutputs'))
    return { ok: false, payjoin: false }
  }

  if (content.type === 'bitcoin_uri') {
    return applyPaymentUriToOutput(content, actions)
  }

  if (content.type !== 'bitcoin_address') {
    actions.onError(t('transaction.error.noValidAddressFound'))
    return { ok: false, payjoin: false }
  }

  actions.setOutputTo(content.cleaned)
  actions.setOutputAmount(UNSET_OUTPUT_AMOUNT_SATS)
  actions.setOutputLabel('')
  actions.setPayjoinUri?.(undefined)
  return { ok: true, payjoin: false }
}
