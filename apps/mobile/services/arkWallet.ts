import { fetchArkOnchainFeeRates, openArkWallet } from '@/api/ark'
import { ensureArkDatadir } from '@/storage/arkDatadir'
import { getArkMnemonic } from '@/storage/encrypted'
import { getArkAccountOrThrow } from '@/store/ark'
import { getArkServer } from '@/utils/ark'

export async function ensureArkWalletOpen(accountId: string): Promise<true> {
  const account = getArkAccountOrThrow(accountId)

  const server = getArkServer(account.network, account.serverId)
  if (!server) {
    throw new Error('Ark server configuration missing')
  }

  const mnemonic = await getArkMnemonic(accountId)
  if (!mnemonic) {
    throw new Error('Ark mnemonic not found in secure storage')
  }

  const datadir = await ensureArkDatadir(accountId)
  await openArkWallet({
    accountId,
    datadir,
    mnemonic,
    server
  })
  return true
}

/**
 * Next-block fee rate on the Ark account's own network, read from its
 * on-chain wallet. The app-wide estimate follows the selected network, which
 * an Ark account need not share. Null when the estimate is unavailable.
 */
export function fetchArkNextBlockFeeRate(
  accountId: string
): Promise<number | null> {
  const { serverId } = getArkAccountOrThrow(accountId)
  return fetchArkOnchainFeeRates(serverId, accountId).then(
    (rates) => rates.fastSatPerVb,
    () => null
  )
}
