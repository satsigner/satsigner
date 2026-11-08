import { KeychainKind } from 'react-native-bdk-sdk'

type AddressPeeker<T extends { index: number }> = {
  peekAddress: (keychain: KeychainKind, index: number) => T
}

// BDK answers any index of a descriptor without a wildcard (a WIF account)
// with its one script at index 0. A different index back means the keychain
// has no address at the requested index.
function peekDerivedAddress<T extends { index: number }>(
  wallet: AddressPeeker<T>,
  keychain: KeychainKind,
  index: number
) {
  const peeked = wallet.peekAddress(keychain, index)
  if (peeked.index !== index) {
    return
  }
  return peeked
}

/**
 * Only `usedAddresses.size` addresses can be used, so one of the first
 * `size + 1` external indexes is always free unless the keychain runs out.
 */
function findFirstUnusedExternalAddress<
  T extends { index: number; address: string }
>(wallet: AddressPeeker<T>, usedAddresses: Set<string>): T | undefined {
  for (let index = 0; index <= usedAddresses.size; index += 1) {
    const peeked = peekDerivedAddress(wallet, KeychainKind.External, index)
    if (!peeked) {
      return
    }
    if (!usedAddresses.has(peeked.address)) {
      return peeked
    }
  }
}

export { findFirstUnusedExternalAddress, peekDerivedAddress }
