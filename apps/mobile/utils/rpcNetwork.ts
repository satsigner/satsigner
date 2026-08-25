import { type Network } from '@/types/settings/blockchain'

const RPC_PORT_MAINNET = 8332
const RPC_PORT_SIGNET = 38332
const RPC_PORT_TESTNET = 18332

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
      return RPC_PORT_SIGNET
    case 'testnet':
      return RPC_PORT_TESTNET
    default:
      return RPC_PORT_MAINNET
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
    `• mainnet → port ${RPC_PORT_MAINNET} (bitcoind)\n` +
    `• signet → port ${RPC_PORT_SIGNET} (bitcoind -signet)\n` +
    `• testnet → port ${RPC_PORT_TESTNET} (bitcoind -testnet)\n` +
    `For ${network}, the default RPC port is ${defaultPort}.`
  )
}

export { defaultRpcPortForNetwork, expectedCoreChain, formatChainMismatchError }
