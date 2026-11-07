import { useState } from 'react'

import { useAccountsStore } from '@/store/accounts'
import { useArkStore } from '@/store/ark'
import { type ArkExit } from '@/types/models/Ark'
import {
  type ArkExitClaimFeeSpeed,
  getArkExitClaimBlocker,
  getArkExitClaimFeeRate,
  getClaimableArkExits,
  sumArkExitSats
} from '@/utils/arkExit'
import { getArkSweepDestinations } from '@/utils/arkOnchainSweep'
import { findByIdOrFirst } from '@/utils/array'

import {
  useArkExitClaim,
  useArkExitClaimDiscard,
  useArkExitClaimPreview,
  useArkExitClaimRetry,
  useArkExitClaims,
  useArkOnchainFeeRates
} from './useArkExits'

const DEFAULT_FEE_SPEED: ArkExitClaimFeeSpeed = 'regular'

/**
 * Everything the exits screen needs to claim finished exits: where to, at
 * what fee, the previewed terms, and the kept claims still settling.
 */
export function useArkExitClaimFlow(
  accountId: string,
  exits: ArkExit[] | undefined
) {
  const network = useArkStore(
    (state) =>
      state.accounts.find((account) => account.id === accountId)?.network
  )
  const bitcoinAccounts = useAccountsStore((state) => state.accounts)
  const claims = useArkExitClaims(accountId)
  const feeRatesQuery = useArkOnchainFeeRates(accountId)
  const claimMutation = useArkExitClaim(accountId)
  const retryMutation = useArkExitClaimRetry(accountId)
  const discardMutation = useArkExitClaimDiscard(accountId)

  const [pickedDestinationId, setPickedDestinationId] = useState<string>()
  const [feeSpeed, setFeeSpeed] =
    useState<ArkExitClaimFeeSpeed>(DEFAULT_FEE_SPEED)

  // The service lock refuses overlapping claim work, so the panel holds still
  // until the running one settles.
  const claimBusy =
    claimMutation.isPending ||
    retryMutation.isPending ||
    discardMutation.isPending
  const claimable = getClaimableArkExits(exits ?? [])
  const destinations = network
    ? getArkSweepDestinations(bitcoinAccounts, network)
    : []
  const destination = findByIdOrFirst(destinations, pickedDestinationId)
  const feeRate = getArkExitClaimFeeRate(feeRatesQuery.data, feeSpeed)
  const blocker = getArkExitClaimBlocker({
    exits,
    hasDestination: Boolean(destination),
    pendingClaims: claims
  })
  const previewQuery = useArkExitClaimPreview(
    !blocker && destination && feeRate !== undefined
      ? {
          arkAccountId: accountId,
          destinationAccountId: destination.id,
          feeRateSatPerVb: feeRate
        }
      : undefined,
    claimable.map((exit) => exit.vtxoId)
  )
  const preview = previewQuery.isPlaceholderData ? undefined : previewQuery.data
  const submission =
    !blocker &&
    destination &&
    preview &&
    feeRate !== undefined &&
    !previewQuery.isFetching &&
    !claimBusy
      ? {
          approved: preview,
          arkAccountId: accountId,
          destinationAccountId: destination.id,
          feeRateSatPerVb: feeRate
        }
      : undefined

  function selectDestination(destinationId: string) {
    if (!claimBusy) {
      setPickedDestinationId(destinationId)
    }
  }

  function selectFeeSpeed(speed: ArkExitClaimFeeSpeed) {
    if (!claimBusy) {
      setFeeSpeed(speed)
    }
  }

  return {
    blocker,
    claimBusy,
    claimMutation,
    claimable,
    claimableSats: sumArkExitSats(claimable),
    claims,
    destination,
    destinations,
    discardMutation,
    feeRate,
    feeRatesQuery,
    feeSpeed,
    preview,
    previewQuery,
    retryMutation,
    selectDestination,
    selectFeeSpeed,
    submission
  }
}
