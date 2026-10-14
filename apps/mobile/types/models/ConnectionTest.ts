export type NodeInfo = {
  version?: string
  blockHeight?: number
  responseTime?: number
  network?: string
  software?: string
  mempoolSize?: number
  chainWork?: string
  medianFee?: number
  hashRate?: string
}

export type ConnectionTestSuccess = {
  success: true
  blockHeight?: number
  tipTimestampSec?: number
  /**
   * Free-form server banner: Electrum `server.banner`, or for RPC a
   * Sparrow-style line built from `getnetworkinfo.subversion` (+ status).
   */
  banner?: string
  /** True when blockfilterindex=1 is missing — wallet sync will be slow */
  blockFilterIndexMissing?: boolean
}

export type ConnectionTestResult =
  | ConnectionTestSuccess
  | {
      success: false
      error?: string
    }
