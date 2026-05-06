import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import { useBlockchainStore } from '@/store/blockchain'
import type {
  ExplorerTransaction,
  ExplorerTxInput,
  ExplorerTxOutput
} from '@/types/models/ExplorerTransaction'
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
    const hex = await client.getTransaction(txid)

    const tx = TxDecoded.fromHex(hex)

    const inputs: ExplorerTxInput[] = tx.ins.map((inp) => ({
      isCoinbase: tx.isCoinbase(),
      prevTxid: Buffer.from(inp.hash).toReversed().toString('hex'),
      prevVout: inp.index,
      scriptSig: inp.script.toString('hex'),
      sequence: inp.sequence,
      witness: inp.witness.map((w) => w.toString('hex'))
    }))

    const outputs: ExplorerTxOutput[] = tx.outs.map((out, i) => ({
      index: i,
      script: out.script.toString('hex'),
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
    scriptSig: inp.scriptsig,
    sequence: inp.sequence,
    witness: inp.witness ?? []
  }))

  const outputs: ExplorerTxOutput[] = tx.vout.map((out, i) => ({
    index: i,
    script: out.scriptpubkey,
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

function fetchTransaction(
  txid: string,
  url: string,
  backend: string,
  onPhase: (phase: ExplorerLoadingPhase) => void
): Promise<ExplorerTransaction> {
  const fetchPromise =
    backend === 'electrum'
      ? fetchFromElectrum(txid, url, onPhase)
      : fetchFromEsplora(txid, url, onPhase)
  return withTimeout(fetchPromise, url)
}

export function useExplorerTransaction(txid: string | null) {
  const [loadingPhase, setLoadingPhase] = useState<ExplorerLoadingPhase>(null)

  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]

  const query = useQuery({
    enabled: txid !== null && txid.length === TXID_LENGTH,
    gcTime: 0,
    networkMode: 'always',
    queryFn: () =>
      fetchTransaction(txid!, server.url, server.backend, setLoadingPhase),
    queryKey: ['explorer-transaction', txid, server.url, server.backend],
    retry: 1,
    staleTime: time.infinity
  })

  return { ...query, loadingPhase: query.isLoading ? loadingPhase : null }
}
