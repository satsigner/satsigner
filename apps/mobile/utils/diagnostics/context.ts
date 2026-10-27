import NetInfo from '@react-native-community/netinfo'

import { useBlockchainStore } from '@/store/blockchain'
import { useNostrIdentityStore } from '@/store/nostrIdentity'

import type { DiagnosticsContext } from './types'

async function buildDiagnosticsContext(): Promise<DiagnosticsContext> {
  const netState = await NetInfo.fetch()
  return {
    identityRelays: useNostrIdentityStore.getState().relays,
    isOnline: netState.isConnected !== false,
    network: useBlockchainStore.getState().selectedNetwork
  }
}

export { buildDiagnosticsContext }
