import { type KeychainKind } from 'react-native-bdk-sdk'

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

export { peekDerivedAddress }
