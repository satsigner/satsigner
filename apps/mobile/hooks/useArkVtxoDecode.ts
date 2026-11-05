import { useQuery } from '@tanstack/react-query'
import { decodeVtxo, type VtxoData } from 'bitcoin-decoder'

import { fetchArkVtxoEncoded } from '@/api/ark'
import { getArkAccountOrThrow } from '@/store/ark'

import { useArkWallet } from './useArkWallet'

export type ArkVtxoDecoded = {
  encoded: string
  data: VtxoData
}

export function useArkVtxoDecode(
  accountId: string | null | undefined,
  vtxoId: string | null | undefined
) {
  const { data: walletReady } = useArkWallet(accountId)
  return useQuery<ArkVtxoDecoded, Error>({
    enabled: Boolean(walletReady && accountId && vtxoId),
    queryFn: async () => {
      if (!accountId || !vtxoId) {
        throw new Error('Ark account and VTXO ids are required')
      }
      const account = getArkAccountOrThrow(accountId)
      const encoded = await fetchArkVtxoEncoded(
        account.serverId,
        accountId,
        vtxoId
      )
      return { data: decodeVtxo(encoded), encoded }
    },
    queryKey: ['ark', 'vtxo-encoded', accountId, vtxoId],
    // A VTXO's encoding never changes once it exists.
    staleTime: Infinity
  })
}
