import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { type MempoolOracle } from '@/api/blockchain'
import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import BitcoinRpc from '@/api/rpc'
import useMempoolOracle from '@/hooks/useMempoolOracle'
import { useBlockchainStore } from '@/store/blockchain'
import type {
  ExplorerTransaction,
  ExplorerTxInput,
  ExplorerTxOutput
} from '@/types/models/ExplorerTransaction'
import type { Backend, RpcCredentials } from '@/types/settings/blockchain'
import { time } from '@/utils/time'
import { TxDecoded } from '@/utils/txDecoded'

export type ExplorerLoadingPhase = string | null

const TXID_LENGTH = 64
const TIMEOUT_MS = 30_000
const TIMEOUT_TOR_MS = 90_000
function withTimeout<T>(promise: Promise<T>, url: string): Promise<T> {
  const ms = url.includes('.onion') ? TIMEOUT_TOR_MS : TIMEOUT_MS
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      setTimeout(() => {
        reject(new Error('timeout'))
      }, ms)
    })
  ])
}

function bytesToHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('hex')
}

/** Wire-order outpoint hash → explorer txid (Hermes: no TypedArray#toReversed). */
function outpointHashBytesToTxid(hash: Uint8Array): string {
  // eslint-disable-next-line unicorn/no-array-reverse -- Hermes lacks TypedArray#toReversed
  return Buffer.from(hash).reverse().toString('hex')
}

function explorerTxFromHex(hex: string): ExplorerTransaction {
  const tx = TxDecoded.fromHex(hex.trim())

  const inputs: ExplorerTxInput[] = tx.ins.map((inp) => ({
    isCoinbase: tx.isCoinbase(),
    prevTxid: outpointHashBytesToTxid(inp.hash),
    prevVout: inp.index,
    scriptSig: bytesToHex(inp.script),
    sequence: inp.sequence,
    witness: inp.witness.map(bytesToHex)
  }))

  const outputs: ExplorerTxOutput[] = tx.outs.map((out, i) => ({
    index: i,
    script: bytesToHex(out.script),
    value: out.value
  }))

  return {
    hex: hex.trim(),
    inputs,
    isCoinbase: tx.isCoinbase(),
    isSegwit: tx.hasWitnesses(),
    locktime: tx.locktime,
    outputs,
    size: tx.byteLength(),
    txid: tx.getId(),
    version: tx.version,
    vsize: tx.virtualSize(),
    weight: tx.weight()
  }
}

async function fetchFromElectrum(
  txid: string,
  url: string,
  onPhase: (phase: ExplorerLoadingPhase) => void
): Promise<ExplorerTransaction> {
  const shortUrl =
    url.length > 40 ? `${url.slice(0, 20)}...${url.slice(-12)}` : url
  onPhase(`Connecting to ${shortUrl}`)
  const client = await ElectrumClient.initClientFromUrl(url)
  try {
    onPhase(`Loading ${txid.slice(0, 8)}...${txid.slice(-8)}`)
    const hex = await client.getTransactionRaw(txid)
    return explorerTxFromHex(hex)
  } finally {
    client.close()
  }
}

async function fetchFromEsplora(
  txid: string,
  url: string,
  onPhase: (phase: ExplorerLoadingPhase) => void
): Promise<ExplorerTransaction> {
  const shortUrl =
    url.length > 40 ? `${url.slice(0, 20)}...${url.slice(-12)}` : url
  onPhase(`Loading ${txid.slice(0, 8)}...${txid.slice(-8)} from ${shortUrl}`)
  const esplora = new Esplora(url)
  const [tx, hexResult] = await Promise.all([
    esplora.getTxInfo(txid),
    esplora.getTxHex(txid).catch(() => null)
  ])

  const inputs: ExplorerTxInput[] = tx.vin.map((inp) => ({
    address: inp.prevout?.scriptpubkey_address,
    isCoinbase: inp.is_coinbase,
    prevTxid: inp.txid,
    prevVout: inp.vout,
    scriptSig: inp.scriptsig ?? '',
    sequence: inp.sequence,
    value: inp.prevout?.value,
    witness: inp.witness ?? []
  }))

  const outputs: ExplorerTxOutput[] = tx.vout.map((out, i) => ({
    address: out.scriptpubkey_address,
    index: i,
    script: out.scriptpubkey ?? '',
    value: out.value
  }))

  return {
    hex: hexResult?.trim() || undefined,
    inputs,
    isCoinbase: tx.vin[0]?.is_coinbase ?? false,
    isSegwit: tx.vin.some((inp) => inp.witness && inp.witness.length > 0),
    locktime: tx.locktime,
    outputs,
    size: tx.size,
    txid: tx.txid,
    version: tx.version,
    vsize: Math.ceil(tx.weight / 4),
    weight: tx.weight
  }
}

async function fetchFromRpc(
  txid: string,
  url: string,
  rpcCredentials: RpcCredentials | undefined,
  onPhase: (phase: ExplorerLoadingPhase) => void
): Promise<ExplorerTransaction> {
  const shortUrl =
    url.length > 40 ? `${url.slice(0, 20)}...${url.slice(-12)}` : url
  onPhase(`Loading ${txid.slice(0, 8)}...${txid.slice(-8)} from ${shortUrl}`)
  const rpc = new BitcoinRpc(
    url,
    rpcCredentials?.username ?? '',
    rpcCredentials?.password ?? ''
  )
  const hex = await rpc.getRawTransactionHex(txid)
  return explorerTxFromHex(hex)
}

async function fetchFromMempool(
  txid: string,
  oracle: Pick<MempoolOracle, 'baseUrl' | 'getTransactionHex'>,
  onPhase: (phase: ExplorerLoadingPhase) => void
): Promise<ExplorerTransaction> {
  onPhase(`Loading ${txid.slice(0, 8)}...${txid.slice(-8)} from mempool.space`)

  // Prefer JSON (confirmed txs) so we avoid hex decode when possible.
  try {
    return await fetchFromEsplora(txid, oracle.baseUrl, onPhase)
  } catch {
    // Unconfirmed / schema mismatch: fall back to raw hex.
  }

  try {
    const hex = await oracle.getTransactionHex(txid)
    return explorerTxFromHex(hex)
  } catch {
    const esplora = new Esplora(oracle.baseUrl)
    const hex = await esplora.getTxHex(txid)
    return explorerTxFromHex(hex)
  }
}

function fetchTransaction(
  txid: string,
  url: string,
  backend: Backend,
  onPhase: (phase: ExplorerLoadingPhase) => void,
  rpcCredentials?: RpcCredentials
): Promise<ExplorerTransaction> {
  if (backend === 'electrum') {
    return withTimeout(fetchFromElectrum(txid, url, onPhase), url)
  }
  if (backend === 'rpc') {
    return withTimeout(fetchFromRpc(txid, url, rpcCredentials, onPhase), url)
  }
  return withTimeout(fetchFromEsplora(txid, url, onPhase), url)
}

export function useExplorerTransaction(txid: string | null) {
  const [loadingPhase, setLoadingPhase] = useState<ExplorerLoadingPhase>(null)
  const [mempoolTx, setMempoolTx] = useState<ExplorerTransaction | null>(null)
  const [mempoolLoading, setMempoolLoading] = useState(false)
  const [mempoolError, setMempoolError] = useState(false)
  const [loadedTxid, setLoadedTxid] = useState<string | null>(null)

  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const oracle = useMempoolOracle(selectedNetwork)

  const normalizedTxid = txid?.trim().toLowerCase() ?? null

  if (normalizedTxid !== loadedTxid) {
    setLoadedTxid(normalizedTxid)
    setMempoolTx(null)
    setMempoolError(false)
    setMempoolLoading(false)
    setLoadingPhase(null)
  }

  const backendQuery = useQuery({
    enabled: normalizedTxid !== null && normalizedTxid.length === TXID_LENGTH,
    gcTime: 0,
    networkMode: 'always',
    queryFn: () => {
      if (!normalizedTxid) {
        return Promise.reject(new Error('missing_txid'))
      }
      return fetchTransaction(
        normalizedTxid,
        server.url,
        server.backend,
        setLoadingPhase,
        server.rpcCredentials
      )
    },
    queryKey: [
      'explorer-transaction',
      normalizedTxid,
      server.url,
      server.backend,
      server.rpcCredentials?.username,
      selectedNetwork
    ],
    retry: 1,
    staleTime: time.infinity
  })

  async function loadFromMempool() {
    if (!normalizedTxid || normalizedTxid.length !== TXID_LENGTH) {
      return
    }

    setMempoolLoading(true)
    setMempoolError(false)
    setLoadingPhase(
      `Loading ${normalizedTxid.slice(0, 8)}...${normalizedTxid.slice(-8)} from mempool.space`
    )

    try {
      const result = await withTimeout(
        fetchFromMempool(normalizedTxid, oracle, setLoadingPhase),
        oracle.baseUrl
      )
      setMempoolTx(result)
      setMempoolError(false)
    } catch {
      setMempoolTx(null)
      setMempoolError(true)
    } finally {
      setMempoolLoading(false)
      setLoadingPhase(null)
    }
  }

  const useMempool = mempoolTx !== null
  const isLoading = mempoolLoading || (!useMempool && backendQuery.isLoading)
  const isError =
    mempoolError || (!useMempool && !mempoolLoading && backendQuery.isError)

  return {
    data: mempoolTx ?? backendQuery.data,
    error: backendQuery.error,
    isError,
    isLoading,
    loadFromMempool,
    loadingPhase: isLoading ? loadingPhase : null,
    mempoolError,
    useMempool
  }
}
