import { useEcashStore } from '@/store/ecash'
import type { EcashAccountStore } from '@/types/models/Ecash'

/** The ecash store narrowed to one account, read fresh on every call. */
function getEcashAccountStore(accountId: string): EcashAccountStore {
  return {
    addMint: (mint) => useEcashStore.getState().addMint(accountId, mint),
    addProofs: (proofs) =>
      useEcashStore.getState().addProofs(accountId, proofs),
    advanceKeysetCounter: (keysetId, nextCounter) =>
      useEcashStore
        .getState()
        .advanceKeysetCounter(accountId, keysetId, nextCounter),
    getCounters: () => useEcashStore.getState().counters[accountId] ?? [],
    getMints: () => useEcashStore.getState().mints[accountId] ?? [],
    getProofs: () => useEcashStore.getState().proofs[accountId] ?? [],
    getSentTokens: () =>
      (useEcashStore.getState().transactions[accountId] ?? []).flatMap(
        ({ token, type }) => (type === 'send' && token ? [token] : [])
      ),
    updateMintBalance: (mintUrl, balance) =>
      useEcashStore.getState().updateMintBalance(accountId, mintUrl, balance)
  }
}

export { getEcashAccountStore }
