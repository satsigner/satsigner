import type { ArkBalance, ArkServer, ArkServerId } from '@/types/models/Ark'

export type ArkWalletArgs = {
  accountId: string
  mnemonic: string
  server: ArkServer
  datadir: string
  /** Optional bearer for private Ark servers — forwarded as `ark-access-token`. */
  serverAccessToken?: string
}

export type ArkBolt11Invoice = {
  invoice: string
  amountSats: number
}

export interface ArkWalletProvider {
  readonly serverId: ArkServerId
  createWallet: (args: ArkWalletArgs) => Promise<void>
  openWallet: (args: ArkWalletArgs) => Promise<void>
  releaseWallet: (accountId: string) => void
  fetchBalance: (accountId: string) => Promise<ArkBalance>
  newAddress: (accountId: string) => Promise<string>
  createBolt11Invoice: (
    accountId: string,
    amountSats: number
  ) => Promise<ArkBolt11Invoice>
}
