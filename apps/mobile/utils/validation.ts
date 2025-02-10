import ecc from '@bitcoinerlab/secp256k1'
import * as bitcoinjs from 'bitcoinjs-lib'

bitcoinjs.initEccLib(ecc)

export function validateExtendedKey(key: string) {
  // TODO: validate string length
  // TODO: validate checksum
  return key.match(new RegExp('^[xyz](pub|prv)[a-zA-Z0-9]+$')) !== null
}

export function validateDerivationPath(path: string) {
  return path.match(new RegExp("^([mM]/)?([0-9]+[h']?/)*[0-9]+[h']?$")) !== null
}

export function validateFingerprint(fingerprint: string) {
  return fingerprint.match(new RegExp('^[a-fA-F0-9]{8}$')) !== null
}

export function validateDescriptor(descriptor: string) {
  // TODO: this validates simple descriptors, but not complex ones
  const r = new RegExp(
    /^(sh|wsh|pk|pkh|wpkh|combo|multi|sortedmulti|tr|addr|raw|rawtr)\((\[([a-fA-F0-9]{8})?(\/[0-9]+[h']?)+\])?[a-z0-9]+(\/[0-9*])*\)(#[a-z0-9]{8})?$/gim
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
