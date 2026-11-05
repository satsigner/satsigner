import {
  boardArkPsbt,
  fetchArkServerInfo,
  fetchArkTipHeight,
  getArkBoardFundingAddress,
  listArkPendingBoards
} from '@/api/ark'
import { t } from '@/locales'
import { ensureArkWalletOpen } from '@/services/arkWallet'
import { getArkAccountOrThrow, useArkStore } from '@/store/ark'
import { useArkSwapsStore } from '@/store/arkSwaps'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Account } from '@/types/models/Account'
import { type ArkBoardIntent, type ArkPendingBoard } from '@/types/models/Ark'
import { type Network } from '@/types/settings/blockchain'
import {
  buildArkBoardCosignPsbt,
  canAccountFundArkBoard,
  isArkBoardIntentFresh
} from '@/utils/arkBoardFunding'
import { getArkSwapRequiredBoardSats } from '@/utils/arkSwap'
import { autoSelectUtxos } from '@/utils/contentProcessor'

type CosignArkBoardFundingParams = {
  intent: ArkBoardIntent
  psbtBase64: string
  signedTxHex: string
  network: Network
}

type PrepareArkBoardFromAccountParams = {
  arkAccountId: string
  fundingAccount: Account
  amountSats: number
}

async function assertArkBoardIntentFresh(intent: ArkBoardIntent) {
  const [tipHeight, serverInfo] = await Promise.all([
    fetchArkTipHeight(intent.serverId, intent.arkAccountId),
    fetchArkServerInfo(intent.serverId, intent.arkAccountId)
  ])
  const fresh =
    serverInfo !== null &&
    isArkBoardIntentFresh({
      expiryHeight: intent.expiryHeight,
      tipHeight,
      vtxoLifetime: serverInfo.vtxoLifetime
    })
  if (!fresh) {
    throw new Error(t('ark.board.cosign.error.staleIntent'))
  }
}

async function registerArkBoard(
  intent: ArkBoardIntent,
  psbtBase64: string
): Promise<ArkPendingBoard> {
  await assertArkBoardIntentFresh(intent)
  return boardArkPsbt(
    intent.serverId,
    intent.arkAccountId,
    psbtBase64,
    intent.keypairIndex,
    intent.expiryHeight
  )
}

/**
 * Prefills the transaction builder with a single-transaction board funded by
 * a Satsigner on-chain account. Every board gets a fresh funding address so
 * its expiry height starts from the current tip.
 */
export async function prepareArkBoardFromAccount({
  arkAccountId,
  fundingAccount,
  amountSats
}: PrepareArkBoardFromAccountParams): Promise<ArkBoardIntent> {
  const arkAccount = getArkAccountOrThrow(arkAccountId)
  if (!canAccountFundArkBoard(fundingAccount, arkAccount.network)) {
    throw new Error(t('ark.board.fromWallet.error.ineligible'))
  }

  await ensureArkWalletOpen(arkAccountId)
  const fundingInfo = await getArkBoardFundingAddress(
    arkAccount.serverId,
    arkAccountId
  )

  const intent: ArkBoardIntent = {
    ...fundingInfo,
    arkAccountId,
    serverId: arkAccount.serverId
  }
  useArkStore.getState().addBoardIntent(intent)

  const store = useTransactionBuilderStore.getState()
  store.setAccountId(fundingAccount.id)
  store.clearTransaction()
  store.setAccountId(fundingAccount.id)
  store.addOutput({
    amount: amountSats,
    label: t('ark.board.fromWallet.outputLabel'),
    to: fundingInfo.address
  })
  autoSelectUtxos(
    fundingAccount,
    amountSats,
    useBlockchainStore.getState().nextBlockFee,
    { addInput: store.addInput, setFeeRate: store.setFeeRate }
  )
  return intent
}

/**
 * Registers a Satsigner-funded board with the Ark server before the funding
 * transaction is broadcast. Broadcasting first would leave the output locked
 * to a script the server alone can sweep after expiry, so any failure here
 * must stop the broadcast.
 */
export async function cosignArkBoardFunding({
  intent,
  psbtBase64,
  signedTxHex,
  network
}: CosignArkBoardFundingParams): Promise<string> {
  const arkAccount = getArkAccountOrThrow(intent.arkAccountId)
  if (arkAccount.network !== network) {
    throw new Error(t('ark.board.cosign.error.networkMismatch'))
  }

  const otherBoardAddresses = Object.keys(
    useArkStore.getState().boardIntents
  ).filter((address) => address !== intent.address)
  const cosign = buildArkBoardCosignPsbt({
    boardAddress: intent.address,
    network,
    otherBoardAddresses,
    psbtBase64,
    signedTxHex
  })
  if (!cosign.ok) {
    throw new Error(t(`ark.board.cosign.error.${cosign.reason}`))
  }
  const requiredBoardSats = getArkSwapRequiredBoardSats(
    useArkSwapsStore.getState().jobs,
    intent.address
  )
  if (
    requiredBoardSats !== undefined &&
    cosign.amountSats < requiredBoardSats
  ) {
    throw new Error(t('ark.board.cosign.error.belowSwapAmount'))
  }

  await ensureArkWalletOpen(intent.arkAccountId)
  const pendingBoards = await listArkPendingBoards(
    intent.serverId,
    intent.arkAccountId
  )
  const registered =
    pendingBoards.find((board) => board.txid === cosign.txid) ??
    (await registerArkBoard(intent, cosign.psbtBase64))
  if (registered.txid !== cosign.txid) {
    throw new Error(t('ark.board.cosign.error.txidMismatch'))
  }

  const store = useArkStore.getState()
  store.addBoardFundingTxid(cosign.txid)
  store.markBoardIntentCosigned(intent.address, registered)
  return cosign.txid
}
