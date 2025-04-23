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
  // Basic descriptor format validation
  const basicRegex = new RegExp(
    /^(sh|wsh|pk|pkh|wpkh|combo|multi|sortedmulti|tr|addr|raw|rawtr)(\((\[([a-fA-F0-9]{8})?(\/[0-9]+[h']?)+\])?[a-z0-9]+(\/[0-9*])*\))?(\/[0-9*])*(#[a-z0-9]{8})?$/gim
  )
  basicRegex.lastIndex = 0
  const basicTest = basicRegex.test(descriptor)

  // Special handling for nested descriptors with xpub keys
  if (descriptor.startsWith('sh') || descriptor.startsWith('wsh')) {
    // Step 1: Check basic structure
    if (!descriptor.match(/^(sh|wsh)\(wpkh\(.*\)\)$/)) {
      return false
    }

    // Step 2: Extract inner content
    const innerContent = descriptor.match(/^(sh|wsh)\(wpkh\((.*)\)\)$/)?.[2]
    if (!innerContent) {
      return false
    }

    // Step 3: Check fingerprint and derivation path
    const fingerprintMatch = innerContent.match(
      /\[([a-fA-F0-9]{8})(\/[0-9]+[h']?)+\]/
    )
    if (!fingerprintMatch) {
      return false
    }

    // Step 4: Check xpub key and final derivation
    const xpubMatch = innerContent.match(/\]([a-zA-Z0-9]+)(\/[0-9*]+)*$/)
    if (!xpubMatch) {
      return false
    }

    return true
  }

  return basicTest
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
