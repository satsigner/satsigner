import { type Network } from '@/types/settings/blockchain'

const suppressedNetworks = new Set<Network>()

function suppressConnectionPoll(network: Network) {
  suppressedNetworks.add(network)

  return () => {
    suppressedNetworks.delete(network)
  }
}

function isConnectionPollSuppressed(network: Network) {
  return suppressedNetworks.has(network)
}

export { isConnectionPollSuppressed, suppressConnectionPoll }
