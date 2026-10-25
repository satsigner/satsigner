import { useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { type BdkWallet } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { buildReplacementPsbt } from '@/api/bdk'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import { useNetworkInfo } from '@/hooks/useNetworkInfo'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import {
  hasUnfinishedDraft,
  useTransactionBuilderStore
} from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'
import {
  type FeeReplacementDraft,
  type FeeReplacementKind,
  type PrebuiltReplacement
} from '@/types/models/FeeReplacement'
import { type Transaction } from '@/types/models/Transaction'
import { getAccountAddressSets } from '@/utils/address'
import {
  buildCpfpDraft,
  buildDraftFromReplacementPsbt,
  getBumpRecipients,
  getExcludedUtxos,
  getFeeReplacementOptions,
  getTransactionFeeRate,
  minimumReplacementFeeRate,
  pickCpfpUtxo
} from '@/utils/feeReplacement'
import {
  getFeeRateInputMax,
  getFeeRateSliderMax,
  getUsableFeeRate
} from '@/utils/feeWarnings'
import { formatMessage } from '@/utils/notice'
import { extractTransactionDataFromPSBT } from '@/utils/psbt'
import { buildOwnedOutpoints } from '@/utils/sankeyInputOwnership'
import { mapBuildTransactionError } from '@/utils/transaction'
import { getUnusedInternalAddresses } from '@/utils/unusedInternalAddresses'

class FeeReplacementError extends Error {
  constructor(messageKey: string) {
    super(messageKey)
    this.name = 'FeeReplacementError'
  }
}

type FeeReplacementBuild = {
  draft: FeeReplacementDraft
  replacement?: PrebuiltReplacement
}

type FeeReplacementBuildInput = {
  account: Account
  feeRate: number
  kind: FeeReplacementKind
  tx: Transaction
  wallet: BdkWallet
}

function getOutputLabels(
  tx: Transaction,
  destination?: { address: string; label: string }
): Map<string, string> {
  const labels = new Map(
    tx.vout.map((output) => [output.address, output.label ?? ''] as const)
  )
  if (destination) {
    labels.set(destination.address, destination.label)
  }
  return labels
}

function getSelfDestination(account: Account, wallet: BdkWallet): string {
  const { changeAddress } = getUnusedInternalAddresses(account, wallet)
  if (!changeAddress) {
    throw new FeeReplacementError('transaction.feeReplacement.error.failed')
  }
  return changeAddress
}

function buildCpfpReplacement({
  account,
  feeRate,
  tx,
  wallet
}: FeeReplacementBuildInput): FeeReplacementBuild {
  const utxo = pickCpfpUtxo(account, tx.id)
  if (!utxo) {
    throw new FeeReplacementError('transaction.feeReplacement.error.failed')
  }
  const result = buildCpfpDraft({
    destination: getSelfDestination(account, wallet),
    destinationLabel: t('transaction.feeReplacement.cpfp'),
    parentFee: tx.fee ?? 0,
    parentVsize: tx.vsize ?? 0,
    targetFeeRate: feeRate,
    utxo
  })
  if (!result.ok) {
    throw new FeeReplacementError(
      result.reason === 'insufficient'
        ? 'transaction.feeReplacement.error.feeTooHigh'
        : 'transaction.feeReplacement.error.failed'
    )
  }
  return { draft: result.draft }
}

async function buildRbfReplacement({
  account,
  feeRate,
  kind,
  tx,
  wallet
}: FeeReplacementBuildInput): Promise<FeeReplacementBuild> {
  const sweepTo =
    kind === 'cancel' ? getSelfDestination(account, wallet) : undefined
  const recipients =
    kind === 'cancel'
      ? []
      : getBumpRecipients(
          tx.vout,
          getAccountAddressSets(account.addresses).internalAddresses
        )
  if (!recipients) {
    throw new FeeReplacementError('transaction.feeReplacement.error.failed')
  }
  const psbt = await buildReplacementPsbt(wallet, {
    feeRate,
    originalTxid: tx.id,
    recipients,
    sweepTo,
    unspendable: getExcludedUtxos(account)
  })
  const extracted = extractTransactionDataFromPSBT(
    psbt.toBase64(),
    account.network
  )
  if (!extracted) {
    throw new FeeReplacementError('transaction.feeReplacement.error.failed')
  }
  const destination = sweepTo
    ? {
        address: sweepTo,
        label: t('transaction.feeReplacement.cancel.action')
      }
    : undefined
  return {
    draft: buildDraftFromReplacementPsbt({
      addresses: account.addresses,
      extracted,
      feeRate,
      labelByAddress: getOutputLabels(tx, destination)
    }),
    replacement: { psbt, replacesTxid: tx.id }
  }
}

function buildFeeReplacement(
  input: FeeReplacementBuildInput
): Promise<FeeReplacementBuild> {
  if (input.kind === 'cpfp') {
    return Promise.resolve(buildCpfpReplacement(input))
  }
  return buildRbfReplacement(input)
}

function showFeeReplacementError(error: Error) {
  if (error instanceof FeeReplacementError) {
    toast.error(t(error.message))
    return
  }
  toast.error(formatMessage(mapBuildTransactionError(error).message))
}

type UseTransactionFeeReplacementParams = {
  accountId: Account['id']
  kind: FeeReplacementKind | undefined
  txid: Transaction['id']
}

export function useTransactionFeeReplacement({
  accountId,
  kind,
  txid
}: UseTransactionFeeReplacementParams) {
  const account = useAccountsStore((state) =>
    state.accounts.find((entry) => entry.id === accountId)
  )
  const tx = account?.transactions.find((entry) => entry.id === txid)
  const wallet = useGetAccountWallet(accountId)
  const backend = useBlockchainStore(
    (state) => state.configs[state.selectedNetwork].server.backend
  )
  const { nextBlockFee } = useNetworkInfo()
  const [replaceDraft, draftInProgress] = useTransactionBuilderStore(
    useShallow((state) => [
      state.replaceDraft,
      hasUnfinishedDraft(state, accountId)
    ])
  )

  const isAvailable =
    account !== undefined &&
    tx !== undefined &&
    kind !== undefined &&
    getFeeReplacementOptions({
      account,
      backend,
      ownedOutpoints: buildOwnedOutpoints(account),
      tx
    }).actions[kind]

  const minFeeRate = minimumReplacementFeeRate(
    tx ? getTransactionFeeRate(tx) : undefined
  )
  const defaultFeeRate = Math.max(
    minFeeRate,
    getUsableFeeRate(nextBlockFee) ?? minFeeRate
  )

  const { isPending, mutate } = useMutation<FeeReplacementBuild, Error, number>(
    {
      mutationFn: (feeRate) => {
        if (!account || !tx || !kind || !wallet) {
          throw new FeeReplacementError(
            'transaction.feeReplacement.error.failed'
          )
        }
        return buildFeeReplacement({
          account,
          feeRate: Number.isFinite(feeRate)
            ? Math.max(feeRate, minFeeRate)
            : minFeeRate,
          kind,
          tx,
          wallet
        })
      },
      onError: showFeeReplacementError,
      onSuccess: ({ draft, replacement }) => {
        replaceDraft(accountId, draft, replacement)
        router.navigate(
          `/signer/bitcoin/account/${accountId}/signAndSend/previewTransaction`
        )
      }
    }
  )

  return {
    defaultFeeRate,
    draftInProgress,
    feeEstimateVsize: kind === 'cpfp' ? undefined : tx?.vsize,
    feeRateInputMax: Math.max(getFeeRateInputMax(nextBlockFee), minFeeRate),
    feeRateSliderMax: Math.max(getFeeRateSliderMax(nextBlockFee), minFeeRate),
    isAvailable,
    isBuilding: isPending,
    minFeeRate,
    nextBlockFee,
    submitFeeReplacement: mutate,
    tx
  }
}
