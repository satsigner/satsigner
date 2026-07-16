import { type Network } from '@/types/settings/blockchain'

/** Bitcoin Core `getblockchaininfo.chain` values per app network tab. */
function expectedCoreChain(network: Network): string {
  switch (network) {
    case 'signet':
      return 'signet'
    case 'testnet':
      return 'test'
    default:
      return 'main'
  }
}

function defaultRpcPortForNetwork(network: Network): number {
  switch (network) {
    case 'signet':
      return 38332
    case 'testnet':
      return 18332
    default:
      return 8332
  }
}

function formatChainMismatchError(
  network: Network,
  actualChain: string,
  url: string
): string {
  const expected = expectedCoreChain(network)
  const defaultPort = defaultRpcPortForNetwork(network)

  return (
    `Connected to ${url}, but the node is on "${actualChain}" — this screen expects "${expected}".\n` +
    'Each Bitcoin Core process serves one chain only. Use a separate node (or port) per network:\n' +
    `• mainnet → port 8332 (bitcoind)\n` +
    `• signet → port 38332 (bitcoind -signet)\n` +
    `• testnet → port 18332 (bitcoind -testnet)\n` +
    `For ${network}, the default RPC port is ${defaultPort}.`
  )
}

export { defaultRpcPortForNetwork, expectedCoreChain, formatChainMismatchError }
