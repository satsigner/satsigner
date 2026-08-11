import { t } from '@/locales'
import { type Address } from '@/types/models/Address'
import { type Output } from '@/types/models/Output'
import { type ScriptVersionType } from '@/types/models/Script'
import { getScriptVersionType, isChangeOutputLabel } from '@/utils/address'
import {
  mapStonewallChangeOutputs,
  mapStonewallFakeMixOutputs
} from '@/utils/utxo'

export const CHART_REMAINING_BALANCE_LOCAL_ID = 'remainingBalance'

const DEFAULT_SCRIPT_TYPE: ScriptVersionType = 'P2WPKH'
const MIN_HYDRATED_FEE_RATE = 1
const STONEWALL_FAKE_MIX_LOCAL_ID_PREFIX = 'stonewallFakeMix'
const STONEWALL_CHANGE_LOCAL_ID_PREFIX = 'stonewallChange'

export type StonewallPaymentContext = {
  changeScriptType: ScriptVersionType
  effectiveFeeRate: number
  paymentLabel: string
  paymentOutputs: Output[]
  recipientScriptType: ScriptVersionType
  userPaymentAmount: number
}

type StonewallPaymentContextInput = {
  accountAddresses: Pick<Address, 'address' | 'keychain' | 'scriptVersion'>[]
  accountScriptVersion?: ScriptVersionType
  decoyAddress?: string
  localFeeRate: number
  nextBlockFee: number | null
  outputs: Output[]
}

type StonewallPreviewParams = {
  changeAddress: string
  changeValues: number[]
  decoyAddress?: string
  fakeMixLabel?: string
  fakeMixValues: number[]
  fee: number | null
  labelOverrides?: Record<string, string>
  secondChangeAddress?: string
}

type ChartOutputsParams = {
  changeAddress: string
  outputs: Output[]
  previewOutputs: Output[]
  remainingBalance: number
}

export type StonewallMaterializationPlan = {
  fee: number
  outputs: {
    amount: number
    kind?: Output['kind']
    label: string
    to: string
  }[]
}

type StonewallMaterializationParams = {
  changeAddress: string
  changeValues: number[]
  decoyAddress?: string
  fakeMixLabel: string
  fakeMixValues: number[]
  fee: number | null
  labelOverrides?: Record<string, string>
  secondChangeAddress?: string
}

function stonewallFakeMixLocalId(index: number) {
  return `${STONEWALL_FAKE_MIX_LOCAL_ID_PREFIX}-${index}`
}

function stonewallChangeLocalId(index: number) {
  return `${STONEWALL_CHANGE_LOCAL_ID_PREFIX}-${index}`
}

function isStonewallPreviewLocalId(localId?: string) {
  if (!localId) {
    return false
  }
  return (
    localId.startsWith(STONEWALL_FAKE_MIX_LOCAL_ID_PREFIX) ||
    localId.startsWith(STONEWALL_CHANGE_LOCAL_ID_PREFIX)
  )
}

function isStonewallManagedOutput(
  output: Pick<Output, 'kind' | 'localId'> | undefined
) {
  if (!output) {
    return false
  }
  return (
    output.kind === 'fakeMix' ||
    output.kind === 'change' ||
    isStonewallPreviewLocalId(output.localId)
  )
}

/** Local IDs of change / stonewall outputs to strip when returning to IO preview. */
function getEphemeralChangeOutputLocalIds(
  outputs: Pick<Output, 'kind' | 'localId' | 'to'>[],
  changeAddresses: (string | undefined)[]
): string[] {
  const addressSet = new Set<string>()
  for (const address of changeAddresses) {
    if (address) {
      addressSet.add(address)
    }
  }

  const localIds: string[] = []
  for (const output of outputs) {
    if (
      output.kind === 'fakeMix' ||
      output.kind === 'change' ||
      addressSet.has(output.to)
    ) {
      localIds.push(output.localId)
    }
  }
  return localIds
}

type ChartOutputFlags = {
  isChange: boolean
  isFakeMix: boolean
  isReceive: boolean
  isSelfSend: boolean
}

type ChartOutputForClassification = Pick<
  Output,
  'kind' | 'label' | 'localId'
> & {
  amount?: number
  to?: string
  value?: number
}

type ChartOutputClassificationOptions = {
  /**
   * True when this wallet funded the transaction (Sparrow consolidation /
   * self-send). Receive txs that merely pay to our address must stay false.
   */
  isWalletSend?: boolean
}

function getChartOutputAmount(output: ChartOutputForClassification): number {
  return output.amount ?? output.value ?? 0
}

function classifyChartOutput(
  output: ChartOutputForClassification,
  ownAddresses: Set<string>,
  options?: ChartOutputClassificationOptions
): ChartOutputFlags {
  // Ownership: stonewall decoys are wallet change. UI may later promote equal-amount
  // owned outputs to fake-mix via classifyChartOutputs (Sparrow reconstruction).
  const isChange =
    output.kind === 'change' ||
    output.kind === 'fakeMix' ||
    output.localId === CHART_REMAINING_BALANCE_LOCAL_ID ||
    isChangeOutputLabel(output.label ?? '')
  const isOwnAddress = !!output.to && ownAddresses.has(output.to.trim())
  // Sparrow consolidation/self-send: we paid to our own receive address.
  const isSelfSend = options?.isWalletSend === true && !isChange && isOwnAddress
  // Sparrow deposit: someone else paid to our address (not a self-send).
  const isReceive = options?.isWalletSend !== true && !isChange && isOwnAddress

  return { isChange, isFakeMix: false, isReceive, isSelfSend }
}

/**
 * Classify chart outputs with Sparrow-style fake-mix reconstruction.
 *
 * Sparrow (HeadersController): a wallet change output is Fake Mix when the tx
 * has 4 outputs and another output shares the same value. Self-sends (own
 * receive addresses on a wallet send) use the same equal-amount rule.
 */
function classifyChartOutputs(
  outputs: ChartOutputForClassification[],
  ownAddresses: Set<string>,
  options?: ChartOutputClassificationOptions
): ChartOutputFlags[] {
  const baseFlags = outputs.map((output) =>
    classifyChartOutput(output, ownAddresses, options)
  )

  if (outputs.length !== 4 || options?.isWalletSend !== true) {
    return baseFlags
  }

  return baseFlags.map((flags, index) => {
    const isWalletOwned = flags.isChange || flags.isSelfSend
    if (!isWalletOwned) {
      return flags
    }

    const amount = getChartOutputAmount(outputs[index])
    if (amount <= 0) {
      return flags
    }

    const hasEqualPeer = outputs.some(
      (peer, peerIndex) =>
        peerIndex !== index && getChartOutputAmount(peer) === amount
    )
    if (!hasEqualPeer) {
      return flags
    }

    return {
      isChange: false,
      isFakeMix: true,
      isReceive: false,
      isSelfSend: false
    }
  })
}

export function getStonewallPaymentContext(
  input: StonewallPaymentContextInput
): StonewallPaymentContext {
  const paymentOutputs = input.outputs.filter(
    (output) => output.to !== input.decoyAddress
  )
  const userPaymentAmount = paymentOutputs.reduce(
    (sum, output) => sum + output.amount,
    0
  )
  const recipientAddress = paymentOutputs[0]?.to
  const recipientScriptType =
    (recipientAddress && getScriptVersionType(recipientAddress)) ||
    input.accountScriptVersion ||
    DEFAULT_SCRIPT_TYPE
  const changeScriptType =
    input.accountScriptVersion ||
    input.accountAddresses.find((address) => address.keychain === 'external')
      ?.scriptVersion ||
    recipientScriptType
  const effectiveFeeRate =
    input.localFeeRate > MIN_HYDRATED_FEE_RATE
      ? input.localFeeRate
      : (input.nextBlockFee ?? MIN_HYDRATED_FEE_RATE)
  const paymentLabel =
    paymentOutputs.find((output) => output.label?.trim())?.label?.trim() ??
    paymentOutputs[0]?.label ??
    ''

  return {
    changeScriptType,
    effectiveFeeRate,
    paymentLabel,
    paymentOutputs,
    recipientScriptType,
    userPaymentAmount
  }
}

export function buildStonewallPreviewOutputs(
  params: StonewallPreviewParams
): Output[] {
  if (
    params.fee === null ||
    !params.decoyAddress ||
    (params.changeValues.length === 0 && params.fakeMixValues.length === 0)
  ) {
    return []
  }

  const previewOutputs: Output[] = []
  const overrides = params.labelOverrides ?? {}

  for (const [index, amount] of params.fakeMixValues.entries()) {
    const localId = stonewallFakeMixLocalId(index)
    // Decoy equal-amount output → change address (Sparrow: ownership, not a
    // separate “fake mix” kind in the wallet UI).
    previewOutputs.push({
      amount,
      kind: 'change',
      label: overrides[localId] ?? t('sign.changeAddressLabelDefault'),
      localId,
      to: params.decoyAddress
    })
  }

  const changeAddresses = [
    params.changeAddress,
    params.secondChangeAddress
  ].flatMap((address) => (address ? [address] : []))

  for (const [index, amount] of params.changeValues.entries()) {
    const to = changeAddresses[index]
    if (!to) {
      continue
    }
    const localId = stonewallChangeLocalId(index)
    previewOutputs.push({
      amount,
      kind: 'change',
      label: overrides[localId] ?? t('sign.changeAddressLabelDefault'),
      localId,
      to
    })
  }

  return previewOutputs
}

export function buildStonewallMaterializationPlan(
  params: StonewallMaterializationParams
): StonewallMaterializationPlan | null {
  if (params.fee === null) {
    return null
  }

  if (params.fakeMixValues.length > 0 && !params.decoyAddress) {
    return null
  }

  const changeAddresses = [
    params.changeAddress,
    params.secondChangeAddress
  ].flatMap((address) => (address ? [address] : []))

  if (params.changeValues.length > changeAddresses.length) {
    return null
  }

  if (params.changeValues.length === 0 && params.fakeMixValues.length === 0) {
    return null
  }

  const fakeMixOutputs = mapStonewallFakeMixOutputs(
    params.fakeMixValues,
    params.decoyAddress ?? ''
  )
  const changeOutputs = mapStonewallChangeOutputs(
    params.changeValues,
    changeAddresses
  )
  const overrides = params.labelOverrides ?? {}

  const outputs: StonewallMaterializationPlan['outputs'] = []

  for (const [index, output] of fakeMixOutputs.entries()) {
    const localId = stonewallFakeMixLocalId(index)
    outputs.push({
      amount: output.amount,
      kind: 'change',
      label: overrides[localId] ?? t('sign.changeAddressLabelDefault'),
      to: output.to
    })
  }

  for (const [index, output] of changeOutputs.entries()) {
    const localId = stonewallChangeLocalId(index)
    outputs.push({
      amount: output.amount,
      kind: 'change',
      label: overrides[localId] ?? t('sign.changeAddressLabelDefault'),
      to: output.to
    })
  }

  return {
    fee: params.fee,
    outputs
  }
}

export function buildSingleTxChartOutputs(
  params: ChartOutputsParams
): Output[] {
  if (params.previewOutputs.length > 0) {
    return [...params.outputs, ...params.previewOutputs]
  }

  const chartOutputs: Output[] = [...params.outputs]

  if (params.remainingBalance > 0) {
    chartOutputs.push({
      amount: params.remainingBalance,
      kind: 'change',
      label: '',
      localId: CHART_REMAINING_BALANCE_LOCAL_ID,
      to: params.changeAddress
    })
  }

  return chartOutputs
}

export {
  classifyChartOutput,
  classifyChartOutputs,
  getEphemeralChangeOutputLocalIds,
  isStonewallManagedOutput,
  isStonewallPreviewLocalId
}
