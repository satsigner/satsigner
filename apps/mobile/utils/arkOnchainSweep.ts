import {
  ARK_ONCHAIN_MIN_FEE_RATE_SAT_PER_VB,
  ARK_ONCHAIN_SWEEP_INPUT_VBYTES,
  ARK_ONCHAIN_SWEEP_OUTPUT_VBYTES,
  ARK_ONCHAIN_SWEEP_OVERHEAD_VBYTES
} from '@/constants/ark'
import { DUST_LIMIT } from '@/constants/btc'
import { type Account } from '@/types/models/Account'
import { type ArkOnchainUtxo } from '@/types/models/Ark'
import { type Network } from '@/types/settings/blockchain'

type ArkOnchainSweepRejection = 'empty' | 'belowDust'

type ArkOnchainSweep =
  | { ok: true; amountSats: number; feeSats: number }
  | { ok: false; reason: ArkOnchainSweepRejection }

type ArkOnchainSweepBlocker =
  | 'loading'
  | 'exitInProgress'
  | 'busy'
  | 'noDestination'
  | ArkOnchainSweepRejection

function estimateArkOnchainSweepFeeSats(
  inputCount: number,
  feeRateSatPerVb: number
): number {
  const vbytes =
    ARK_ONCHAIN_SWEEP_OVERHEAD_VBYTES +
    ARK_ONCHAIN_SWEEP_INPUT_VBYTES * inputCount +
    ARK_ONCHAIN_SWEEP_OUTPUT_VBYTES
  return Math.ceil(vbytes * feeRateSatPerVb)
}

function computeArkOnchainSweep({
  utxos,
  feeRateSatPerVb
}: {
  utxos: Pick<ArkOnchainUtxo, 'amountSats'>[]
  feeRateSatPerVb: number
}): ArkOnchainSweep {
  if (utxos.length === 0) {
    return { ok: false, reason: 'empty' }
  }
  const totalSats = utxos.reduce((total, utxo) => total + utxo.amountSats, 0)
  const feeSats = estimateArkOnchainSweepFeeSats(utxos.length, feeRateSatPerVb)
  const amountSats = totalSats - feeSats
  if (amountSats < DUST_LIMIT) {
    return { ok: false, reason: 'belowDust' }
  }
  return { amountSats, feeSats, ok: true }
}

function isValidArkOnchainFeeRate(feeRateSatPerVb: number): boolean {
  return (
    Number.isFinite(feeRateSatPerVb) &&
    feeRateSatPerVb >= ARK_ONCHAIN_MIN_FEE_RATE_SAT_PER_VB
  )
}

function canAccountReceiveArkSweep(
  account: Pick<Account, 'keys' | 'network'>,
  network: Network
): boolean {
  const [firstKey] = account.keys
  if (account.network !== network || !firstKey) {
    return false
  }
  return firstKey.creationType !== 'importAddress'
}

function getArkSweepDestinations<T extends Pick<Account, 'keys' | 'network'>>(
  accounts: T[],
  network: Network
): T[] {
  return accounts.filter((account) =>
    canAccountReceiveArkSweep(account, network)
  )
}

function getArkOnchainSweepBlocker({
  pendingExitSats,
  spendInFlight,
  hasDestination,
  sweep
}: {
  pendingExitSats: number | undefined
  spendInFlight: boolean
  hasDestination: boolean
  sweep: ArkOnchainSweep | undefined
}): ArkOnchainSweepBlocker | undefined {
  if (pendingExitSats === undefined || !sweep) {
    return 'loading'
  }
  if (pendingExitSats > 0) {
    return 'exitInProgress'
  }
  if (spendInFlight) {
    return 'busy'
  }
  if (!sweep.ok) {
    return sweep.reason
  }
  if (!hasDestination) {
    return 'noDestination'
  }
}

export {
  type ArkOnchainSweep,
  type ArkOnchainSweepBlocker,
  type ArkOnchainSweepRejection,
  canAccountReceiveArkSweep,
  computeArkOnchainSweep,
  getArkOnchainSweepBlocker,
  getArkSweepDestinations,
  isValidArkOnchainFeeRate
}
