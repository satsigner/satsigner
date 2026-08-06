import { type BdkWallet, KeychainKind } from 'react-native-bdk-sdk'

const MAX_EXTERNAL_ADDRESS_SCAN = 1000

type ExternalAddressWallet = Pick<BdkWallet, 'peekAddress'>

type ExternalAddressInfo = {
  address: string
  index: number
}

type ReceiveAddressSelection = {
  address: string
  index: number
  path: string
  qrUri: string
}

function findExternalAddressIndex(
  wallet: ExternalAddressWallet,
  address: string
): number | undefined {
  for (const index of Array.from(
    { length: MAX_EXTERNAL_ADDRESS_SCAN },
    (_, value) => value
  )) {
    try {
      const peeked = wallet.peekAddress(KeychainKind.External, index)
      if (peeked?.address === address) {
        return index
      }
    } catch {
      return undefined
    }
  }
  return undefined
}

function resolveReceiveAddressSelection(params: {
  wallet: ExternalAddressWallet
  derivationPath: string
  preferredAddress?: string
  fallback: ExternalAddressInfo
}): ReceiveAddressSelection {
  const { wallet, derivationPath, preferredAddress, fallback } = params
  const address = preferredAddress || fallback.address
  const index =
    address === fallback.address
      ? fallback.index
      : (findExternalAddressIndex(wallet, address) ?? fallback.index)

  return {
    address,
    index,
    path: `${derivationPath}/0/${index}`,
    qrUri: `bitcoin:${address}`
  }
}

export {
  findExternalAddressIndex,
  MAX_EXTERNAL_ADDRESS_SCAN,
  resolveReceiveAddressSelection
}
export type { ExternalAddressInfo, ReceiveAddressSelection }
