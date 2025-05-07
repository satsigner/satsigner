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
  // regex expressions building blocks
  const kind = '(sh|wsh|pk|pkh|wpkh|combo|tr|addr|raw|rawtr)'
  const nestedKind = '(sh|wsh)'
  const multiKind = `(multi|sortedmulti)`
  const fingerprint = '[a-fA-F0-9]{8}'
  const keyDerivationPath = `\\/[0-9]+[h']?`
  const fullFingerprint = `\\[(${fingerprint})?(${keyDerivationPath})+\\]`
  const content = '[a-zA-Z0-9]+'
  const addressDerivationPath = '(\\/[0-9*])*'
  const checksum = '#[a-z0-9]{8}'
  const key = `(${fullFingerprint})?${content}${addressDerivationPath}`
  const singleKey = `^${kind}\\(${key}\\)$`
  const multiKey = `^${multiKind}\\([1-9][0-9]*,(${key},)+${key}\\)$`
  const nestedDescriptor = `^${nestedKind}\\(.+\\)$`

  // auxiliary regex to extract nested items
  const checksumRegex = new RegExp(`${checksum}$`)
  const nestedKindRegex = new RegExp(`^${nestedKind}\\(`)

  // main regex to parse the descriptor
  const singleKeyRegex = new RegExp(singleKey, 'gm')
  const multiKeyRegex = new RegExp(multiKey, 'gm')
  const nestedRegex = new RegExp(nestedDescriptor, 'gm')

  // Remove checksum if any.
  // Nested descriptor have only 1 checksum, that is why we remove it first.
  // Because we remove it, we also do not need to check it again.
  let currentItem = descriptor.replace(checksumRegex, '')

  // Extract nested descriptor.
  // Example: wsh(sh(pkh(...))) -> pkh(...)
  while (nestedRegex.test(currentItem)) {
    // first, check if the current item is a single key sh/wsh descriptor
    if (singleKeyRegex.test(currentItem)) return true

    // extract it
    currentItem = currentItem.replace(nestedKindRegex, '').replace(/\)$/, '')
  }

  // It must be either single key or multi key
  return singleKeyRegex.test(currentItem) || multiKeyRegex.test(currentItem)
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
