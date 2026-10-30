import { type Network } from '@/types/settings/blockchain'

const suppressedNetworks = new Set<Network>()
const listeners = new Set<() => void>()

function notifyListeners() {
  for (const listener of listeners) {
    listener()
  }
}

function suppressConnectionPoll(network: Network) {
  suppressedNetworks.add(network)
  notifyListeners()

  return () => {
    suppressedNetworks.delete(network)
    notifyListeners()
  }
}

function isConnectionPollSuppressed(network: Network) {
  return suppressedNetworks.has(network)
}

function subscribeToConnectionPollSuppression(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export {
  isConnectionPollSuppressed,
  subscribeToConnectionPollSuppression,
  suppressConnectionPoll
}
