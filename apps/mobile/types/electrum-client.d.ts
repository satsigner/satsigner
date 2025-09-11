declare module 'electrum-client' {
  export default class ElectrumClient {
    constructor(
      net: any,
      tls: any,
      port: number,
      host: string,
      protocol: string,
      options: any
    )
    timeout?: NodeJS.Timeout
    timeLastCall: number
    socket?: {
      destroy(): void
    }
    reconnect(): void
    onError(error: Error): void
    server_ping(): Promise<void>
    initElectrum(params: { client: string; version: string }): Promise<void>
    close(): void
    blockchainScripthash_getBalance(
      scriptHash: string
    ): Promise<{ confirmed: number; unconfirmed: number }>
    blockchainScripthash_listunspent(
      scriptHash: string
    ): Promise<
      Array<{ height: number; tx_hash: string; tx_pos: number; value: number }>
    >
    blockchainScripthash_getHistory(
      scriptHash: string
    ): Promise<Array<{ height: number; tx_hash: string }>>
    blockchainScripthash_getMempool(
      scriptHash: string
    ): Promise<Array<{ height: number; tx_hash: string; fee: number }>>
    blockchainTransaction_get(txid: string, verbose?: boolean): Promise<string>
    blockchainBlock_header(height: number): Promise<string>
    blockchainTransaction_broadcast(rawTxHex: string): Promise<string>
  }
}
