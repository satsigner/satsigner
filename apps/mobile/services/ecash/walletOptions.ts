import { getEcashMnemonic } from '@/storage/encrypted'
import { useEcashStore } from '@/store/ecash'
import type { WalletOptions } from '@/types/models/Ecash'
import { mnemonicToSeed } from '@/utils/bip39'
import { buildCounterInit } from '@/utils/ecashKeysetCounters'

/** BIP39 seed for a seeded ecash account, or undefined when none is stored. */
async function getEcashSeed(accountId: string) {
  const mnemonic = await getEcashMnemonic(accountId)
  if (!mnemonic) {
    return undefined
  }
  return mnemonicToSeed(mnemonic, '')
}

function getEcashCounters(accountId: string) {
  return useEcashStore.getState().counters[accountId] ?? []
}

/**
 * Options for a wallet of one account: its seed and keyset counters, so the
 * proofs it mints can be restored from the seed later.
 */
async function getEcashWalletOptions(
  accountId: string
): Promise<WalletOptions> {
  const account = useEcashStore
    .getState()
    .accounts.find(({ id }) => id === accountId)
  if (!account?.hasSeed) {
    return {}
  }
  const seed = await getEcashSeed(accountId)
  if (!seed) {
    return {}
  }
  return {
    bip39seed: seed,
    counterInit: buildCounterInit(getEcashCounters(accountId)),
    onCounterReserved: ({ keysetId, start, count }) => {
      useEcashStore
        .getState()
        .advanceKeysetCounter(accountId, keysetId, start + count)
    }
  }
}

export { getEcashCounters, getEcashSeed, getEcashWalletOptions }
