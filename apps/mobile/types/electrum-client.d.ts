declare module 'electrum-client' {
  export default class ElectrumClient {
    constructor(
      net: unknown,
      tls: unknown,
      port: number,
      host: string,
      protocol: string,
      options: Record<string, unknown>
    )
    timeout?: NodeJS.Timeout
    timeLastCall: number
    socket?: {
      destroy(): void
    }
    /** Internal socket the library opens on construction (not public API). */
    conn?: {
      setTimeout?: (timeout: number) => void
    }
    reconnect(): void
    onError(error: Error): void
    server_ping(): Promise<void>
    server_banner(): Promise<string>
    /** Resolves with the untrusted `server.version` response. */
    server_version(
      clientName: string,
      protocolVersion: string
    ): Promise<unknown>
    /** Connects, then resolves with the untrusted `server.version` response. */
    initElectrum(
      params: { client: string; version: string },
      persistencePolicy?: { maxRetry: number; callback: null | (() => void) }
    ): Promise<unknown>
    close(): void
    blockchainScripthash_getBalance(
      scriptHash: string
    ): Promise<{ confirmed: number; unconfirmed: number }>
    blockchainScripthash_listunspent(
      scriptHash: string
    ): Promise<
      { height: number; tx_hash: string; tx_pos: number; value: number }[]
    >
    blockchainScripthash_getHistory(
      scriptHash: string
    ): Promise<{ height: number; tx_hash: string }[]>
    blockchainScripthash_getMempool(
      scriptHash: string
    ): Promise<{ height: number; tx_hash: string; fee: number }[]>
    blockchainHeaders_subscribe(): Promise<{ height: number }>
    blockchainTransaction_get(txid: string, verbose?: boolean): Promise<string>
    blockchainBlock_header(height: number): Promise<string>
    blockchainTransaction_broadcast(rawTxHex: string): Promise<string>
    mempool_getFeeHistogram(): Promise<[number, number][]>
  }
}
