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

function explorerTxFromHex(hex: string): ExplorerTransaction {
  const tx = TxDecoded.fromHex(hex)

  const inputs: ExplorerTxInput[] = tx.ins.map((inp) => ({
    isCoinbase: tx.isCoinbase(),
    prevTxid: bytesToHex(Buffer.from(inp.hash).toReversed()),
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
  const tx = await esplora.getTxInfo(txid)

  const inputs: ExplorerTxInput[] = tx.vin.map((inp) => ({
    isCoinbase: inp.is_coinbase,
    prevTxid: inp.txid,
    prevVout: inp.vout,
    scriptSig: inp.scriptsig ?? '',
    sequence: inp.sequence,
    witness: inp.witness ?? []
  }))

  const outputs: ExplorerTxOutput[] = tx.vout.map((out, i) => ({
    index: i,
    script: out.scriptpubkey ?? '',
    value: out.value
  }))

  return {
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
  oracle: Pick<MempoolOracle, 'getTransactionHex'>,
  onPhase: (phase: ExplorerLoadingPhase) => void
): Promise<ExplorerTransaction> {
  onPhase(`Loading ${txid.slice(0, 8)}...${txid.slice(-8)} from mempool.space`)
  const hex = await oracle.getTransactionHex(txid)
  return explorerTxFromHex(hex)
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
  const [useMempool, setUseMempool] = useState(false)

  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const oracle = useMempoolOracle(selectedNetwork)

  const query = useQuery({
    enabled: txid !== null && txid.length === TXID_LENGTH,
    gcTime: 0,
    networkMode: 'always',
    queryFn: () => {
      if (!txid) {
        return Promise.reject(new Error('missing_txid'))
      }
      if (useMempool) {
        return withTimeout(
          fetchFromMempool(txid, oracle, setLoadingPhase),
          oracle.baseUrl
        )
      }
      return fetchTransaction(
        txid,
        server.url,
        server.backend,
        setLoadingPhase,
        server.rpcCredentials
      )
    },
    queryKey: [
      'explorer-transaction',
      txid,
      server.url,
      server.backend,
      server.rpcCredentials?.username,
      useMempool,
      selectedNetwork
    ],
    retry: 1,
    staleTime: time.infinity
  })

  function loadFromMempool() {
    setUseMempool(true)
  }

  return {
    ...query,
    loadFromMempool,
    loadingPhase: query.isLoading ? loadingPhase : null,
    useMempool
  }
}
