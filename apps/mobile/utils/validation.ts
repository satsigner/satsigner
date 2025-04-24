import ecc from '@bitcoinerlab/secp256k1'
import * as bitcoinjs from 'bitcoinjs-lib'

bitcoinjs.initEccLib(ecc)

export function validateExtendedKey(key: string) {
  // TODO: validate string length: 111 characters?
  // TODO: validate checksum
  return key.match(new RegExp('^[txyz](pub|prv)[a-zA-Z0-9]+$')) !== null
}

export function validateDerivationPath(path: string) {
  return path.match(new RegExp("^([mM]/)?([0-9]+[h']?/)*[0-9]+[h']?$")) !== null
}

export function validateFingerprint(fingerprint: string) {
  return fingerprint.match(new RegExp('^[a-fA-F0-9]{8}$')) !== null
}

export function validateDescriptor(descriptor: string) {
  const kind = `(sh|wsh|pk|pkh|wpkh|combo|multi|sortedmulti|tr|addr|raw|rawtr)`
  const fingerprint = `[a-fA-F0-9]{8}`
  const keyDerivationPath = `\\/[0-9]+[h']?`
  const fullFingerprint = `\\[(${fingerprint})?(${keyDerivationPath})+\\]`
  const content = `[a-zA-Z0-9]+`
  const addressDerivationPath = `(\\/[0-9*])*`
  const checksum = `#[a-z0-9]{8}`
  const basicRegex = `^${kind}\\((${fullFingerprint})?${content}${addressDerivationPath}\\)(${checksum})?$`

  const r = new RegExp(basicRegex, 'gm')
  return r.test(descriptor)
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
      // Continue to next network if validation fails
    }
  }
  return false
}
