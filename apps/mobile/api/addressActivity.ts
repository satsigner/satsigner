import ElectrumClient from '@/api/electrum'
import { assertElectrumReachable } from '@/api/electrumReachability'
import Esplora from '@/api/esplora'
import {
  QUICK_CHECK_ELECTRUM_BATCH_SIZE,
  QUICK_CHECK_ESPLORA_PARALLEL_REQUESTS
} from '@/constants/sync'
import type { Server } from '@/types/settings/blockchain'
import { chunk } from '@/utils/array'
import type { AddressActivity } from '@/utils/quickCheck'

type ReadOptions = {
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new Error('Address activity read cancelled')
  }
}

async function readElectrumActivity(
  server: Server,
  addresses: readonly string[],
  { onProgress, signal }: ReadOptions
): Promise<AddressActivity[]> {
  await assertElectrumReachable(server.url)
  const client = await ElectrumClient.initClientFromUrl(
    server.url,
    server.network
  )
  try {
    const activity: AddressActivity[] = []
    for (const batch of chunk(
      [...addresses],
      QUICK_CHECK_ELECTRUM_BATCH_SIZE
    )) {
      throwIfAborted(signal)
      // oxlint-disable-next-line no-await-in-loop -- one batch at a time on one socket
      const histories = await client.getAddressHistories(batch)
      for (const [index, history] of histories.entries()) {
        activity.push({
          address: batch[index],
          confirmedCount: history.filter((entry) => entry.height > 0).length,
          unconfirmedTxids: history
            .filter((entry) => entry.height <= 0)
            .map((entry) => entry.tx_hash)
        })
      }
      onProgress?.(activity.length, addresses.length)
    }
    return activity
  } finally {
    client.close()
  }
}

async function readEsploraAddress(
  esplora: Esplora,
  address: string
): Promise<AddressActivity> {
  const counts = await esplora.getAddressTxCounts(address)
  const mempoolTxs =
    counts.mempool > 0 ? await esplora.getAddressTxsInMempool(address) : []
  return {
    address,
    confirmedCount: counts.confirmed,
    unconfirmedTxids: mempoolTxs.map((tx) => tx.txid)
  }
}

async function readEsploraActivity(
  server: Server,
  addresses: readonly string[],
  { onProgress, signal }: ReadOptions
): Promise<AddressActivity[]> {
  const esplora = new Esplora(server.url)
  const activity: AddressActivity[] = []
  for (const batch of chunk(
    [...addresses],
    QUICK_CHECK_ESPLORA_PARALLEL_REQUESTS
  )) {
    throwIfAborted(signal)
    // oxlint-disable-next-line no-await-in-loop -- bounded parallel requests
    const results = await Promise.all(
      batch.map((address) => readEsploraAddress(esplora, address))
    )
    activity.push(...results)
    onProgress?.(activity.length, addresses.length)
  }
  return activity
}

/**
 * What an Electrum or Esplora server reports for each address: confirmed
 * transaction count and unconfirmed txids. Bitcoin Core is not supported: its
 * wallet sync is already incremental.
 */
function readAddressActivity(
  server: Server,
  addresses: readonly string[],
  options: ReadOptions = {}
): Promise<AddressActivity[]> {
  if (addresses.length === 0) {
    return Promise.resolve([])
  }
  if (server.backend === 'electrum') {
    return readElectrumActivity(server, addresses, options)
  }
  if (server.backend === 'esplora') {
    return readEsploraActivity(server, addresses, options)
  }
  return Promise.reject(
    new Error('Quick checks need an Electrum or Esplora server')
  )
}

export { readAddressActivity }
