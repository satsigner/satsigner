import { useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { type BdkWallet, type PsbtLike } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { buildReplacementPsbt, isUtxoInWallet } from '@/api/bdk'
import { BDK_FEE_BUMP_TARGET_NOT_FOUND_ERROR_MARKER } from '@/constants/transaction'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import { useNetworkInfo } from '@/hooks/useNetworkInfo'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
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
import { type Backend } from '@/types/settings/blockchain'
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
import { isWifAccount } from '@/utils/wif'

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
  backend: Backend
  feeRate: number
  kind: FeeReplacementKind
  syncWallet: () => Promise<void>
  tx: Transaction
  wallet: BdkWallet
}

function isFeeBumpTargetNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes(BDK_FEE_BUMP_TARGET_NOT_FOUND_ERROR_MARKER)
  )
}

async function buildReplacementPsbtAfterSync(
  input: FeeReplacementBuildInput,
  data: Parameters<typeof buildReplacementPsbt>[1]
): Promise<PsbtLike> {
  try {
    return await buildReplacementPsbt(input.wallet, data)
  } catch (error) {
    if (!isFeeBumpTargetNotFound(error)) {
      throw error
    }
    // Broadcasting does not add the transaction to the BDK wallet; it only
    // gets there with the next sync.
    await input.syncWallet()
    return buildReplacementPsbt(input.wallet, data)
  }
}

function getOutputLabels(
  tx: Transaction,
  changeAddresses: Set<string>,
  destination?: { address: string; label: string }
): Map<string, string> {
  const labels = new Map(
    tx.vout
      .filter((output) => !changeAddresses.has(output.address))
      .map(
        (output) => [output.address, output.label || tx.label || ''] as const
      )
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

async function buildCpfpReplacement(
  input: FeeReplacementBuildInput
): Promise<FeeReplacementBuild> {
  const { account, feeRate, tx, wallet } = input
  const utxo = pickCpfpUtxo(account, tx.id)
  if (!utxo) {
    throw new FeeReplacementError('transaction.feeReplacement.error.failed')
  }
  // The child is built by the BDK wallet, which only learns a just-broadcast
  // parent with the next sync. The Core backend builds it from its own wallet.
  if (input.backend !== 'rpc' && !isUtxoInWallet(wallet, utxo)) {
    await input.syncWallet()
    if (!isUtxoInWallet(wallet, utxo)) {
      throw new FeeReplacementError(
        'transaction.feeReplacement.error.notInWallet'
      )
    }
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

async function buildRbfReplacement(
  input: FeeReplacementBuildInput
): Promise<FeeReplacementBuild> {
  const { account, feeRate, kind, tx, wallet } = input
  const sweepTo =
    kind === 'cancel' ? getSelfDestination(account, wallet) : undefined
  // A WIF account sends change back to its one address, so that address is
  // the change output to shrink and the target for the new change.
  const changeAddress = isWifAccount(account)
    ? getSelfDestination(account, wallet)
    : undefined
  const changeAddresses = changeAddress
    ? new Set([changeAddress])
    : getAccountAddressSets(account.addresses).internalAddresses
  const recipients =
    kind === 'cancel' ? [] : getBumpRecipients(tx.vout, changeAddresses)
  if (!recipients) {
    throw new FeeReplacementError('transaction.feeReplacement.error.failed')
  }
  const psbt = await buildReplacementPsbtAfterSync(input, {
    changeAddress,
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
      changeLabel: t('sign.changeAddressLabelDefault'),
      extracted,
      feeRate,
      labelByAddress: getOutputLabels(tx, changeAddresses, destination)
    }),
    replacement: { psbt, replacesTxid: tx.id }
  }
}

function buildFeeReplacement(
  input: FeeReplacementBuildInput
): Promise<FeeReplacementBuild> {
  if (input.kind === 'cpfp') {
    return buildCpfpReplacement(input)
  }
  return buildRbfReplacement(input)
}

function showFeeReplacementError(error: Error) {
  if (error instanceof FeeReplacementError) {
    toast.error(t(error.message))
    return
  }
  if (isFeeBumpTargetNotFound(error)) {
    toast.error(t('transaction.feeReplacement.error.notInWallet'))
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
  const updateAccount = useAccountsStore((state) => state.updateAccount)
  const { syncAccountWithWallet } = useSyncAccountWithWallet()
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
          backend,
          feeRate: Number.isFinite(feeRate)
            ? Math.max(feeRate, minFeeRate)
            : minFeeRate,
          kind,
          syncWallet: async () => {
            const synced = await syncAccountWithWallet(account, wallet)
            if (synced) {
              updateAccount(synced)
            }
          },
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
