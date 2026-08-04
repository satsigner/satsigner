import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import useMempoolOracle from '@/hooks/useMempoolOracle'
import { useBlockchainStore } from '@/store/blockchain'
import type { TxOutspend, TxStatus } from '@/types/models/Blockchain'
import { time } from '@/utils/time'

export type ExplorerTransactionEnrichment = {
  status: TxStatus
  outspends: TxOutspend[]
}

const EMPTY_STATUS: TxStatus = {
  block_hash: '',
  block_height: 0,
  block_time: 0,
  confirmed: false
}

function parseStatus(raw: unknown): TxStatus {
  if (!raw || typeof raw !== 'object' || !('confirmed' in raw)) {
    return EMPTY_STATUS
  }
  return {
    block_hash:
      'block_hash' in raw && typeof raw.block_hash === 'string'
        ? raw.block_hash
        : '',
    block_height:
      'block_height' in raw && typeof raw.block_height === 'number'
        ? raw.block_height
        : 0,
    block_time:
      'block_time' in raw && typeof raw.block_time === 'number'
        ? raw.block_time
        : 0,
    confirmed: Boolean(raw.confirmed)
  }
}

function parseOutspends(raw: unknown): TxOutspend[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.map((item, index) => {
    const spent =
      item && typeof item === 'object' && 'spent' in item
        ? Boolean(item.spent)
        : false
    return {
      spent,
      status: EMPTY_STATUS,
      txid:
        item &&
        typeof item === 'object' &&
        'txid' in item &&
        typeof item.txid === 'string'
          ? item.txid
          : '',
      vin: index
    }
  })
}

export function useExplorerTransactionEnrich(txid: string | null) {
  const selectedNetwork = useBlockchainStore((state) => state.selectedNetwork)
  const oracle = useMempoolOracle(selectedNetwork)
  const [enabledForTxid, setEnabledForTxid] = useState<string | null>(null)

  const normalizedTxid = txid?.trim().toLowerCase() ?? null
  const enabled =
    normalizedTxid !== null &&
    normalizedTxid.length === 64 &&
    enabledForTxid === normalizedTxid

  const query = useQuery({
    enabled,
    queryFn: async (): Promise<ExplorerTransactionEnrichment> => {
      if (!normalizedTxid) {
        throw new Error('missing_txid')
      }
      const [statusRaw, outspendsRaw] = await Promise.all([
        oracle.get(`/tx/${normalizedTxid}/status`),
        oracle.get(`/tx/${normalizedTxid}/outspends`)
      ])
      return {
        outspends: parseOutspends(outspendsRaw),
        status: parseStatus(statusRaw)
      }
    },
    queryKey: ['explorer-tx-enrich', normalizedTxid, selectedNetwork],
    staleTime: time.minutes(5)
  })

  function loadFromMempool() {
    if (!normalizedTxid || normalizedTxid.length !== 64) {
      return
    }
    setEnabledForTxid(normalizedTxid)
  }

  return {
    ...query,
    loadFromMempool,
    loaded: enabled
  }
}
