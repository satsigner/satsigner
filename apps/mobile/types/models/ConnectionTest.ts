import {
  type Backend,
  type Network,
  type RpcCredentials
} from '@/types/settings/blockchain'

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

export type ConnectionTestFailure = {
  success: false
  error?: string
}

export type ConnectionTestResult = ConnectionTestSuccess | ConnectionTestFailure

export type ProbeParams = {
  url: string
  backend: Backend
  network: Network
  rpcCredentials?: RpcCredentials
}
