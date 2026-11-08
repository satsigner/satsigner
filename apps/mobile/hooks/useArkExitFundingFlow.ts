import { useState } from 'react'

import { useAccountsStore } from '@/store/accounts'
import { useArkStore } from '@/store/ark'
import { type ArkExit } from '@/types/models/Ark'
import {
  getArkExitFundingAmount,
  getArkExitFundingSources,
  getArkExitIncomingFundingSats,
  getUnconfirmedArkExits
} from '@/utils/arkExit'
import { findByIdOrFirst } from '@/utils/array'

import {
  useArkExitFeeEstimate,
  useArkExitFeeFunding
} from './useArkExitFeeEstimate'
import { useArkExitFunding } from './useArkExits'

/**
 * What the exits still waiting to confirm need from the on-chain fee wallet,
 * and the wallet the user would top it up from.
 */
export function useArkExitFundingFlow(
  accountId: string,
  exits: ArkExit[] | undefined
) {
  const network = useArkStore(
    (state) =>
      state.accounts.find((account) => account.id === accountId)?.network
  )
  const bitcoinAccounts = useAccountsStore((state) => state.accounts)
  const fundingMutation = useArkExitFunding(accountId)
  const [pickedSourceId, setPickedSourceId] = useState<string>()

  const unconfirmedIds = getUnconfirmedArkExits(exits ?? []).map(
    (exit) => exit.vtxoId
  )
  const feeEstimateQuery = useArkExitFeeEstimate({
    accountId,
    enabled: unconfirmedIds.length > 0,
    poll: true,
    vtxoIds: unconfirmedIds
  })
  const { balanceQuery, funding } = useArkExitFeeFunding({
    accountId,
    enabled: unconfirmedIds.length > 0,
    exitBroadcastFeeSats: feeEstimateQuery.data?.exitBroadcastFeeSats
  })

  const shortfallSats = funding?.shortfallSats ?? 0
  const amountSats = getArkExitFundingAmount(shortfallSats)
  const sources = network
    ? getArkExitFundingSources(bitcoinAccounts, network)
    : []
  const source = findByIdOrFirst(sources, pickedSourceId)

  function retry() {
    feeEstimateQuery.refetch()
    balanceQuery.refetch()
  }

  return {
    amountSats,
    error: feeEstimateQuery.error ?? balanceQuery.error,
    fundingInput: source
      ? { amountSats, fundingAccountId: source.id }
      : undefined,
    fundingMutation,
    incomingSats: getArkExitIncomingFundingSats(funding),
    retry,
    selectSource: setPickedSourceId,
    shortfallSats,
    source,
    sources
  }
}
