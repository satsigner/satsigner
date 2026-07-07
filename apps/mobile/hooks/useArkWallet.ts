import { useQuery } from '@tanstack/react-query'

import { openArkWallet } from '@/api/ark'
import { ensureArkDatadir } from '@/storage/arkDatadir'
import { getArkMnemonic } from '@/storage/encrypted'
import { getArkAccountOrThrow, getArkServer } from '@/utils/ark'

async function ensureWalletOpen(accountId: string): Promise<true> {
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

export function useArkWallet(accountId: string | null | undefined) {
  return useQuery({
    enabled: Boolean(accountId),
    gcTime: Infinity,
    queryFn: () => {
      if (!accountId) {
        throw new Error('Ark account id is required')
      }
      return ensureWalletOpen(accountId)
    },
    queryKey: ['ark', 'wallet', accountId],
    staleTime: Infinity
  })
}
