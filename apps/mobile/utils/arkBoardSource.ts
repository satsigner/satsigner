import { ARK_BOARDING_WALLET_SOURCE_ID } from '@/constants/ark'
import { type Account } from '@/types/models/Account'
import { type ScriptVersionType } from '@/types/models/Script'
import { type Network } from '@/types/settings/blockchain'
import { getAccountTotalBalance } from '@/utils/account'
import { canAccountFundArkBoard } from '@/utils/arkBoardFunding'

type ArkBoardFundingAccount = Pick<
  Account,
  'id' | 'keys' | 'name' | 'network' | 'policyType' | 'summary'
>

type ArkBoardAccountSource = {
  kind: 'account'
  id: string
  name: string
  availableSats: number
  policyType: Account['policyType']
  scriptVersion: ScriptVersionType | undefined
}

type ArkBoardSource =
  | {
      kind: 'boardingWallet'
      id: typeof ARK_BOARDING_WALLET_SOURCE_ID
      availableSats: number
    }
  | ArkBoardAccountSource

function toAccountSource(
  account: ArkBoardFundingAccount
): ArkBoardAccountSource {
  return {
    availableSats: getAccountTotalBalance(account.summary),
    id: account.id,
    kind: 'account',
    name: account.name,
    policyType: account.policyType,
    scriptVersion: account.keys[0]?.scriptVersion
  }
}

type GetArkBoardSourcesParams = {
  accounts: ArkBoardFundingAccount[]
  boardingWalletSats: number
  network: Network
}

/**
 * Every on-chain account able to fund a single-transaction board, richest
 * first.
 */
function getArkBoardAccountSources(
  accounts: ArkBoardFundingAccount[],
  network: Network
): ArkBoardAccountSource[] {
  return accounts
    .filter((account) => canAccountFundArkBoard(account, network))
    .map(toAccountSource)
    .toSorted((a, b) => b.availableSats - a.availableSats)
}

/**
 * Where a board can be funded from inside Satsigner: the Ark boarding wallet
 * when it holds coins, then the on-chain accounts.
 */
function getArkBoardSources({
  accounts,
  boardingWalletSats,
  network
}: GetArkBoardSourcesParams): ArkBoardSource[] {
  const accountSources = getArkBoardAccountSources(accounts, network)

  if (boardingWalletSats <= 0) {
    return accountSources
  }
  return [
    {
      availableSats: boardingWalletSats,
      id: ARK_BOARDING_WALLET_SOURCE_ID,
      kind: 'boardingWallet'
    },
    ...accountSources
  ]
}

/**
 * The source the user picked, or the first one able to cover the minimum
 * board amount when nothing (or a source that disappeared) was picked.
 */
function resolveArkBoardSource<Source extends ArkBoardSource>(
  sources: Source[],
  pickedId: string | undefined,
  minAmountSats: number
): Source | undefined {
  const picked = sources.find((source) => source.id === pickedId)
  if (picked) {
    return picked
  }
  return (
    sources.find((source) => source.availableSats >= minAmountSats) ??
    sources[0]
  )
}

export {
  type ArkBoardAccountSource,
  type ArkBoardSource,
  getArkBoardAccountSources,
  getArkBoardSources,
  resolveArkBoardSource
}
