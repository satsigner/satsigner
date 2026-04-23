import {
  Config,
  Network as BarkNetwork,
  Wallet,
  type WalletLike
} from '@secondts/bark-react-native'

import type { ArkBalance, ArkServer } from '@/types/models/Ark'
import type { Network } from '@/types/settings/blockchain'

import type {
  ArkBolt11Invoice,
  ArkWalletArgs,
  ArkWalletProvider
} from '../provider'
import { registerArkProvider } from '../registry'

const walletCache = new Map<string, WalletLike>()

function appNetworkToBarkNetwork(network: Network): BarkNetwork {
  switch (network) {
    case 'bitcoin':
      return BarkNetwork.Bitcoin
    case 'signet':
      return BarkNetwork.Signet
    case 'testnet':
      return BarkNetwork.Testnet
    default:
      return BarkNetwork.Signet
  }
}

function buildConfig(server: ArkServer, serverAccessToken?: string): Config {
  return Config.create({
    esploraAddress: server.esploraUrl,
    network: appNetworkToBarkNetwork(server.network),
    serverAccessToken: serverAccessToken || undefined,
    serverAddress: server.arkUrl
  })
}

function getCachedWallet(accountId: string): WalletLike {
  const wallet = walletCache.get(accountId)
  if (!wallet) {
    throw new Error(`Ark wallet not opened for account '${accountId}'`)
  }
  return wallet
}

async function createWallet({
  accountId,
  mnemonic,
  server,
  datadir,
  serverAccessToken
}: ArkWalletArgs): Promise<void> {
  const wallet = await Wallet.create(
    mnemonic,
    buildConfig(server, serverAccessToken),
    datadir,
    false
  )
  walletCache.set(accountId, wallet)
}

async function openWallet({
  accountId,
  mnemonic,
  server,
  datadir,
  serverAccessToken
}: ArkWalletArgs): Promise<void> {
  if (walletCache.has(accountId)) {
    return
  }
  const wallet = await Wallet.open(
    mnemonic,
    buildConfig(server, serverAccessToken),
    datadir
  )
  walletCache.set(accountId, wallet)
}

function releaseWallet(accountId: string): void {
  const wallet = walletCache.get(accountId)
  if (wallet && Wallet.instanceOf(wallet)) {
    wallet.uniffiDestroy()
  }
  walletCache.delete(accountId)
}

function newAddress(accountId: string): Promise<string> {
  const wallet = getCachedWallet(accountId)
  return wallet.newAddress()
}

async function createBolt11Invoice(
  accountId: string,
  amountSats: number
): Promise<ArkBolt11Invoice> {
  const wallet = getCachedWallet(accountId)
  const invoice = await wallet.bolt11Invoice(BigInt(amountSats))
  return {
    amountSats: Number(invoice.amountSats),
    invoice: invoice.invoice
  }
}

async function fetchBalance(accountId: string): Promise<ArkBalance> {
  const wallet = getCachedWallet(accountId)
  const balance = await wallet.balance()
  return {
    claimableLightningReceiveSats: Number(
      balance.claimableLightningReceiveSats
    ),
    pendingBoardSats: Number(balance.pendingBoardSats),
    pendingExitSats: Number(balance.pendingExitSats),
    pendingInRoundSats: Number(balance.pendingInRoundSats),
    pendingLightningSendSats: Number(balance.pendingLightningSendSats),
    spendableSats: Number(balance.spendableSats)
  }
}

const barkProvider: ArkWalletProvider = {
  createBolt11Invoice,
  createWallet,
  fetchBalance,
  newAddress,
  openWallet,
  releaseWallet,
  serverId: 'second'
}

registerArkProvider(barkProvider)
