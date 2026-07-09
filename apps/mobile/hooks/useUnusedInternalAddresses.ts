import { type BdkWallet, KeychainKind } from 'react-native-bdk-sdk'

import { UNUSED_INTERNAL_ADDRESSES_NEEDED } from '@/constants/btc'
import { type Account } from '@/types/models/Account'

const MAX_INTERNAL_ADDRESS_SCAN = 1000

function getUsedOutputAddresses(account: Account): Set<string> {
  const used = new Set<string>()
  for (const tx of account.transactions) {
    for (const output of tx.vout) {
      used.add(output.address)
    }
  }
  return used
}

function useUnusedInternalAddresses(account?: Account, wallet?: BdkWallet) {
  const empty = {
    changeAddress: '',
    decoyAddress: '',
    secondChangeAddress: ''
  }

  if (!account || !wallet) {
    return empty
  }

  const usedOutputAddresses = getUsedOutputAddresses(account)
  const unusedInternal: string[] = []

  for (
    let i = 0;
    i < MAX_INTERNAL_ADDRESS_SCAN &&
    unusedInternal.length < UNUSED_INTERNAL_ADDRESSES_NEEDED;
    i += 1
  ) {
    const address = wallet.peekAddress(KeychainKind.Internal, i)?.address ?? ''
    if (address && !usedOutputAddresses.has(address)) {
      unusedInternal.push(address)
    }
  }

  return {
    changeAddress: unusedInternal[0] ?? '',
    decoyAddress: unusedInternal[2] ?? '',
    secondChangeAddress: unusedInternal[1] ?? ''
  }
}

export default useUnusedInternalAddresses
