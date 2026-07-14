import { t } from '@/locales'
import { type Address } from '@/types/models/Address'
import { type Output } from '@/types/models/Output'
import { type ScriptVersionType } from '@/types/models/Script'
import { getScriptVersionType } from '@/utils/address'

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
  secondChangeAddress?: string
}

type ChartOutputsParams = {
  changeAddress: string
  outputs: Output[]
  previewOutputs: Output[]
  remainingBalance: number
}

function stonewallFakeMixLocalId(index: number) {
  return `${STONEWALL_FAKE_MIX_LOCAL_ID_PREFIX}-${index}`
}

function stonewallChangeLocalId(index: number) {
  return `${STONEWALL_CHANGE_LOCAL_ID_PREFIX}-${index}`
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

  for (const [index, amount] of params.fakeMixValues.entries()) {
    previewOutputs.push({
      amount,
      kind: 'fakeMix',
      label: params.fakeMixLabel ?? '',
      localId: stonewallFakeMixLocalId(index),
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
    previewOutputs.push({
      amount,
      label: t('sign.changeAddressLabelDefault'),
      localId: stonewallChangeLocalId(index),
      to
    })
  }

  return previewOutputs
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
      label: '',
      localId: CHART_REMAINING_BALANCE_LOCAL_ID,
      to: params.changeAddress
    })
  }

  return chartOutputs
}
