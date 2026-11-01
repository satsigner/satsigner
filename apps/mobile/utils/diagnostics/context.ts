import NetInfo from '@react-native-community/netinfo'

import { normalizeRelayUrl } from '@/api/nostrRelayHealth'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useNostrIdentityStore } from '@/store/nostrIdentity'

import type { DiagnosticsContext } from './types'

/** Relays the app is actually configured to use, including per-identity lists. */
function configuredNostrRelays(): string[] {
  const { identities, relays } = useNostrIdentityStore.getState()
  const identityRelays = identities.flatMap((identity) => identity.relays ?? [])
  const accountRelays = useAccountsStore
    .getState()
    .accounts.flatMap((account) => account.nostr?.relays ?? [])
  return [
    ...new Set(
      [...identityRelays, ...relays, ...accountRelays]
        .map(normalizeRelayUrl)
        .filter((url) => url.length > 0)
    )
  ]
}

async function buildDiagnosticsContext(): Promise<DiagnosticsContext> {
  const netState = await NetInfo.fetch()
  return {
    identityRelays: configuredNostrRelays(),
    isOnline: netState.isConnected !== false,
    network: useBlockchainStore.getState().selectedNetwork
  }
}

export { buildDiagnosticsContext }
