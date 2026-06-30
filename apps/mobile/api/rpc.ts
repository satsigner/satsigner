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
  adjustRpcUrl,
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

// ─── Bitcoin Core wallet types ───────────────────────────────────────────────

export type CoreWalletListTx = {
  address?: string
  /** BTC — negative means the wallet sent funds */
  amount: number
  blockheight?: number
  blockhash?: string
  blocktime?: number
  category: 'send' | 'receive' | 'generate' | 'immature' | 'orphan'
  confirmations: number
  fee?: number
  label?: string
  time: number
  timereceived: number
  txid: string
  vout: number
}

export type CoreWalletInfo = {
  balance: number
  descriptors: boolean
  scanning: false | { duration: number; progress: number }
  unconfirmed_balance: number
  walletname: string
}

export type CoreUnspent = {
  address?: string
  /** BTC */
  amount: number
  confirmations: number
  desc?: string
  scriptPubKey?: string
  spendable: boolean
  solvable: boolean
  txid: string
  vout: number
}

export type CoreTxDetails = {
  amount: number
  blockhash?: string
  blockheight?: number
  blocktime?: number
  confirmations: number
  decoded?: RpcTransaction
  details: CoreWalletListTx[]
  fee?: number
  hex: string
  time: number
  timereceived: number
  txid: string
}

export type ImportDescriptorRequest = {
  active?: boolean
  desc: string
  internal?: boolean
  label?: string
  range?: [number, number]
  timestamp: number | 'now'
}

export type ImportDescriptorResult = {
  success: boolean
  error?: { code: number; message: string }
  warnings?: string[]
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

  /**
   * Get the normalized (checksum-appended) form of a descriptor.
   * Bitcoin Core requires checksums in importdescriptors calls.
   */
  async getDescriptorInfo(
    descriptor: string
  ): Promise<{ descriptor: string; isrange: boolean; issolvable: boolean }> {
    return this._call('getdescriptorinfo', [descriptor])
  }

  /** List wallets currently loaded in the node. */
  async listWallets(): Promise<string[]> {
    return this._call<string[]>('listwallets')
  }

  /**
   * Load a wallet. Silently succeeds if it is already loaded.
   * Returns the wallet name on success.
   */
  async loadWallet(
    name: string
  ): Promise<{ name: string; warning?: string }> {
    return this._call('loadwallet', [name])
  }

  /**
   * Create a new watch-only descriptor wallet.
   * disable_private_keys=true, blank=true, descriptors=true, load_on_startup=true
   */
  async createWallet(
    name: string
  ): Promise<{ name: string; warning?: string }> {
    return this._call('createwallet', [
      name,
      true,  // disable_private_keys
      true,  // blank
      '',    // passphrase
      false, // avoid_reuse
      true,  // descriptors
      true   // load_on_startup
    ])
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

// ─── Bitcoin Core wallet client ───────────────────────────────────────────────
// Wallet-level RPC calls go to /wallet/<name>; node-level calls stay on /.

export class BitcoinCoreWallet {
  private nodeRpc: BitcoinRpc
  private password: string
  private username: string
  private walletName: string
  private walletUrl: string

  constructor(
    nodeUrl: string,
    username: string,
    password: string,
    walletName: string
  ) {
    const adjusted = adjustRpcUrl(nodeUrl)
    this.nodeRpc = new BitcoinRpc(adjusted, username, password)
    this.username = username
    this.password = password
    this.walletName = walletName
    this.walletUrl = `${adjusted.replace(/\/$/, '')}/wallet/${encodeURIComponent(walletName)}`
  }

  private async _walletCall<T>(method: string, params: unknown[] = []): Promise<T> {
    const body = {
      id: method,
      jsonrpc: '1.0' as const,
      method,
      params
    }
    const credentials = btoa(`${this.username}:${this.password}`)
    let response: Response
    try {
      response = await fetch(this.walletUrl, {
        body: JSON.stringify(body),
        cache: 'no-cache',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json'
        },
        method: 'POST'
      })
    } catch (err) {
      throw toUserFacingError(err, this.walletUrl)
    }
    if (response.status === 401)
      throw toUserFacingError(new Error('401 Unauthorized'), this.walletUrl)
    if (response.status === 403)
      throw toUserFacingError(new Error('403 Forbidden'), this.walletUrl)
    if (!response.ok)
      throw new Error(`Node returned HTTP ${response.status}`)
    const data = (await response.json()) as {
      error: { code: number; message: string } | null
      result: T
    }
    if (data.error)
      throw new Error(`RPC error ${data.error.code}: ${data.error.message}`)
    return data.result
  }

  /**
   * Ensure the wallet exists and is loaded.
   * Creates it if it doesn't exist yet, loads it if it isn't loaded.
   */
  async ensureWallet(): Promise<void> {
    const loaded = await this.nodeRpc.listWallets()
    if (loaded.includes(this.walletName)) return

    // Try loading first (it might exist on disk but not be loaded)
    try {
      await this.nodeRpc.loadWallet(this.walletName)
      return
    } catch {
      // Wallet doesn't exist on disk — create it
    }

    await this.nodeRpc.createWallet(this.walletName)
  }

  async getWalletInfo(): Promise<CoreWalletInfo> {
    return this._walletCall<CoreWalletInfo>('getwalletinfo')
  }

  /**
   * Import one or more descriptors into this wallet.
   * Returns per-descriptor success/error results.
   */
  async importDescriptors(
    descriptors: ImportDescriptorRequest[]
  ): Promise<ImportDescriptorResult[]> {
    return this._walletCall<ImportDescriptorResult[]>('importdescriptors', [
      descriptors
    ])
  }

  /**
   * Fetch all wallet transactions in reverse chronological order.
   * count=0 means "return all" (Bitcoin Core default is 10; we pass a large value).
   */
  async listTransactions(count = 99999): Promise<CoreWalletListTx[]> {
    return this._walletCall<CoreWalletListTx[]>('listtransactions', [
      '*',
      count,
      0,
      true // include_watchonly
    ])
  }

  /**
   * Get all transactions since `blockHash` (FullyNoded-style incremental sync).
   * Pass an empty string to get all transactions from genesis.
   * Returns both the new transactions and the current tip `lastblock` hash
   * which should be stored and passed on the next call.
   */
  async listSinceBlock(blockHash: string): Promise<{
    lastblock: string
    transactions: CoreWalletListTx[]
  }> {
    return this._walletCall('listsinceblock', [
      blockHash,
      1,    // target_confirmations
      true, // include_watchonly
      true  // include_removed (catch re-orgs)
    ])
  }

  async listUnspent(): Promise<CoreUnspent[]> {
    return this._walletCall<CoreUnspent[]>('listunspent', [
      0,      // minconf
      9999999 // maxconf
    ])
  }

  /**
   * Fetch a single wallet transaction with the decoded (verbose) form included.
   * verbose=true requires Bitcoin Core 19.0+.
   */
  async getTransaction(txid: string): Promise<CoreTxDetails> {
    return this._walletCall<CoreTxDetails>('gettransaction', [
      txid,
      true,  // include_watchonly
      true   // verbose — adds "decoded" field with full vin/vout
    ])
  }

  /**
   * Normalise a descriptor and append its required checksum.
   * Automatically splits multi-path `<0;1>` descriptors into external/internal
   * pairs because `getdescriptorinfo` does not accept that notation.
   * Returns [externalDescriptor, internalDescriptor].
   */
  async normalizeDescriptors(
    extDescriptor: string,
    intDescriptor: string
  ): Promise<[string, string]> {
    const [extNorm, intNorm] = await Promise.all([
      this.nodeRpc
        .getDescriptorInfo(extDescriptor)
        .then((r) => r.descriptor),
      this.nodeRpc
        .getDescriptorInfo(intDescriptor)
        .then((r) => r.descriptor)
    ])
    return [extNorm, intNorm]
  }

  /** List all descriptors currently loaded in this wallet (Core 21+). */
  async listDescriptors(): Promise<{
    descriptors: Array<{
      active: boolean
      desc: string
      internal: boolean
      next_index: number
      range: [number, number]
      timestamp: number
    }>
    wallet_name: string
  }> {
    return this._walletCall('listdescriptors')
  }

  /**
   * Trigger a blockchain rescan starting at `startHeight`.
   * This call is synchronous — it blocks until the rescan completes.
   * Callers should wrap it in a timeout and switch to polling
   * `getWalletInfo().scanning` if the connection is dropped.
   */
  async rescanBlockchain(
    startHeight: number
  ): Promise<{ start_height: number; stop_height: number }> {
    return this._walletCall('rescanblockchain', [startHeight])
  }

  get name(): string {
    return this.walletName
  }
}
