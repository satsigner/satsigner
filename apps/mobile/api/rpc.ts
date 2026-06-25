import { Platform } from 'react-native'

import { type Network } from '@/types/settings/blockchain'

/**
 * On Android, localhost/127.0.0.1 refers to the device itself, not the host
 * machine. Remap to 10.0.2.2 (the standard Android emulator alias for the
 * host) so users can enter familiar addresses and have them just work.
 * Matches the same pattern used in the mining (energy.tsx) feature.
 */
function adjustRpcUrl(url: string): string {
  if (Platform.OS !== 'android') return url
  try {
    const parsed = new URL(url)
    if (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname.startsWith('172.')
    ) {
      parsed.hostname = '10.0.2.2'
      return parsed.toString()
    }
  } catch {
    // fall through
  }
  return url
}

/**
 * Translate raw network errors into actionable user-facing messages.
 * Covers the common failure modes when connecting to a local Bitcoin Core node.
 */
function toUserFacingError(err: unknown, url: string): Error {
  const raw = err instanceof Error ? err.message : String(err)

  // TCP connection refused — nothing is listening on that port
  if (raw.includes('Failed to connect') || raw.includes('ECONNREFUSED')) {
    return new Error(
      `Could not reach node at ${url}.\n` +
        'Check that Bitcoin Core is running and that the host/port are correct.\n' +
        'On Android emulator use 10.0.2.2 instead of 127.0.0.1.'
    )
  }

  // Connection reset — port is reachable but connection was immediately dropped.
  // Most common causes: rpcallowip blocking the device IP, or a VPN/proxy
  // (e.g. Orbot) routing local IPs through Tor.
  if (raw.includes('Connection reset') || raw.includes('ConnectionReset')) {
    return new Error(
      `Connected to ${url} but the node reset the connection.\n` +
        'Possible causes:\n' +
        '• rpcallowip in bitcoin.conf does not include your device IP — add rpcallowip=192.168.0.0/16\n' +
        '• A VPN or Tor proxy (e.g. Orbot) is routing local traffic through Tor — disable full-device VPN mode for local connections'
    )
  }

  // HTTP 401 — wrong username or password
  if (raw.includes('401') || raw.includes('Unauthorized')) {
    return new Error(
      'Authentication failed (HTTP 401).\n' +
        'Check that the RPC username and password match bitcoin.conf (rpcuser / rpcpassword).'
    )
  }

  // HTTP 403 — IP not in rpcallowip
  if (raw.includes('403') || raw.includes('Forbidden')) {
    return new Error(
      'Node refused the connection (HTTP 403).\n' +
        'Add your device IP to bitcoin.conf: rpcallowip=192.168.0.0/16\n' +
        'Then restart Bitcoin Core.'
    )
  }

  // Timeout
  if (
    raw.includes('timeout') ||
    raw.includes('timed out') ||
    raw.includes('AbortError')
  ) {
    return new Error(
      `Connection to ${url} timed out.\n` +
        'Check that the host and port are correct and that no firewall is blocking the connection.'
    )
  }

  return err instanceof Error ? err : new Error(raw)
}

const RPC_DEFAULT_PORT_MAINNET = 8332
const RPC_DEFAULT_PORT_SIGNET = 38332
const RPC_DEFAULT_PORT_TESTNET = 18332

export {
  RPC_DEFAULT_PORT_MAINNET,
  RPC_DEFAULT_PORT_SIGNET,
  RPC_DEFAULT_PORT_TESTNET
}

type RpcRequest = {
  id: string
  jsonrpc: '1.0'
  method: string
  params: unknown[]
}

type RpcResponse<T> = {
  error: { code: number; message: string } | null
  id: string
  result: T
}

export type BlockchainInfo = {
  bestblockhash: string
  blocks: number
  chain: string
  chainwork: string
  difficulty: number
  headers: number
  mediantime: number
  pruned: boolean
  verificationprogress: number
}

export type RpcBlock = {
  bits: string
  confirmations: number
  difficulty: number
  hash: string
  height: number
  mediantime: number
  merkleroot: string
  nextblockhash?: string
  nonce: number
  previousblockhash: string
  size: number
  time: number
  tx: string[]
  version: number
  weight: number
}

export type RpcVin = {
  coinbase?: string
  sequence: number
  txid?: string
  txinwitness?: string[]
  vout?: number
}

export type RpcVout = {
  n: number
  scriptPubKey: {
    address?: string
    addresses?: string[]
    asm: string
    hex: string
    type: string
  }
  value: number
}

export type RpcTransaction = {
  blockhash?: string
  blocktime?: number
  confirmations?: number
  hash: string
  hex: string
  locktime: number
  size: number
  time?: number
  txid: string
  version: number
  vin: RpcVin[]
  vout: RpcVout[]
  vsize: number
  weight: number
}

export type MempoolInfo = {
  bytes: number
  loaded: boolean
  maxmempool: number
  mempoolminfee: number
  minrelaytxfee: number
  size: number
  usage: number
}

export type SmartFeeResult = {
  blocks: number
  errors?: string[]
  feerate?: number
}

export default class BitcoinRpc {
  private password: string
  private url: string
  private username: string

  constructor(url: string, username: string, password: string) {
    this.url = adjustRpcUrl(url)
    this.username = username
    this.password = password
  }

  private async _call<T>(method: string, params: unknown[] = []): Promise<T> {
    const body: RpcRequest = {
      id: method,
      jsonrpc: '1.0',
      method,
      params
    }

    const credentials = btoa(`${this.username}:${this.password}`)

    let response: Response
    try {
      response = await fetch(this.url, {
        body: JSON.stringify(body),
        cache: 'no-cache',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json'
        },
        method: 'POST'
      })
    } catch (err) {
      throw toUserFacingError(err, this.url)
    }

    if (response.status === 401) {
      throw toUserFacingError(new Error('401 Unauthorized'), this.url)
    }

    if (response.status === 403) {
      throw toUserFacingError(new Error('403 Forbidden'), this.url)
    }

    if (!response.ok) {
      throw new Error(`Node returned HTTP ${response.status}`)
    }

    const data = (await response.json()) as RpcResponse<T>

    if (data.error) {
      throw new Error(`RPC error ${data.error.code}: ${data.error.message}`)
    }

    return data.result
  }

  async estimateSmartFee(confTarget: number): Promise<SmartFeeResult> {
    return this._call<SmartFeeResult>('estimatesmartfee', [confTarget])
  }

  async getBlock(hash: string): Promise<RpcBlock> {
    return this._call<RpcBlock>('getblock', [hash, 1])
  }

  async getBlockCount(): Promise<number> {
    return this._call<number>('getblockcount')
  }

  async getBlockHash(height: number): Promise<string> {
    return this._call<string>('getblockhash', [height])
  }

  async getBlockchainInfo(): Promise<BlockchainInfo> {
    return this._call<BlockchainInfo>('getblockchaininfo')
  }

  /**
   * Check whether `blockfilterindex=1` is enabled.
   * BDK's syncWithRpc uses getblockfilter per block; without the index Bitcoin
   * Core computes filters on-the-fly (reads full block from disk) making each
   * call 10-100× slower. Returns true if the index is available.
   */
  async hasBlockFilterIndex(): Promise<boolean> {
    try {
      type IndexInfo = Record<string, { synced: boolean; best_block_height: number }>
      const info = await this._call<IndexInfo>('getindexinfo')
      return 'basic block filter index' in info || 'blockfilterindex' in info
    } catch {
      return false
    }
  }

  async getMempoolInfo(): Promise<MempoolInfo> {
    return this._call<MempoolInfo>('getmempoolinfo')
  }

  async getRawTransaction(txid: string): Promise<RpcTransaction> {
    return this._call<RpcTransaction>('getrawtransaction', [txid, true])
  }

  async getRawTransactionHex(txid: string): Promise<string> {
    return this._call<string>('getrawtransaction', [txid, false])
  }

  async sendRawTransaction(txHex: string): Promise<string> {
    return this._call<string>('sendrawtransaction', [txHex])
  }

  static defaultPort(network: Network): number {
    if (network === 'testnet') return RPC_DEFAULT_PORT_TESTNET
    if (network === 'signet') return RPC_DEFAULT_PORT_SIGNET
    return RPC_DEFAULT_PORT_MAINNET
  }

  static async test(
    url: string,
    username: string,
    password: string,
    timeout: number
  ): Promise<boolean> {
    const adjustedUrl = adjustRpcUrl(url)
    const client = new BitcoinRpc(adjustedUrl, username, password)

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Connection to ${adjustedUrl} timed out`)),
        timeout
      )
    )

    try {
      await Promise.race([client.getBlockchainInfo(), timeoutPromise])
      return true
    } catch {
      return false
    }
  }
}
