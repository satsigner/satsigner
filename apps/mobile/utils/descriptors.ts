import * as bitcoinjs from 'bitcoinjs-lib'

export function validateExtendedKey(key: string) {
  // TODO: check string length
  return key.match(new RegExp('^[xyz](pub|priv)[a-zA-Z0-9]+$')) !== null
}

export function validateDerivationPath(path: string) {
  return path.match(new RegExp("^([mM]/)?([0-9]+[h']?/)*[0-9]+[h']?$")) !== null
}

export function validateFingerprint(fingerprint: string) {
  return fingerprint.match(new RegExp('^[a-fA-F0-9]{6}$')) !== null
}

export function validateDescriptor(descriptor: string) {
  // TODO: this validates simple descriptors, but not complex ones
  const r = new RegExp(
    /(sh|wsh|pk|pkh|wpkh|combo|multi|sortedmulti|tr|addr|raw|rawtr)\((\[([a-fA-F0-9]{6})?(\/[0-9]+[h']?)+\])?[a-z0-9]+(\/[0-9*])*\)(#[a-z0-9]{8})?$/gm
  )
  return descriptor.match(r) !== null
}

export function validateAddress(address: string) {
  const networks = [
    bitcoinjs.networks.bitcoin,
    bitcoinjs.networks.testnet,
    bitcoinjs.networks.regtest
  ]
  for (const network of networks) {
    try {
      bitcoinjs.address.toOutputScript(address, network)
      return true
    } catch {
      //
    }
  }
  return false
}
