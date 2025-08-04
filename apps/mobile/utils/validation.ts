import ecc from '@bitcoinerlab/secp256k1'
import * as bitcoinjs from 'bitcoinjs-lib'
import { Descriptor } from 'bdk-rn'
import { Network } from 'bdk-rn/lib/lib/enums'

bitcoinjs.initEccLib(ecc)

export function validateExtendedKey(key: string) {
  // TODO: validate string length: 111 characters?
  // TODO: validate checksum
  return key.match(new RegExp('^[tvxyz](pub|prv)[a-zA-Z0-9]+$')) !== null
}

export function validateDerivationPath(path: string) {
  return path.match(new RegExp("^([mM]/)?([0-9]+[h']?/)*[0-9]+[h']?$")) !== null
}

export function validateFingerprint(fingerprint: string) {
  return fingerprint.match(new RegExp('^[a-fA-F0-9]{8}$')) !== null
}

// Function to validate descriptor checksum using BDK
async function validateDescriptorChecksum(
  descriptor: string
): Promise<{ isValid: boolean; error?: string }> {
  // Use a more lenient regex to detect truncated checksums
  const checksumRegex = /#[a-z0-9]{1,8}$/
  const hasChecksum = checksumRegex.test(descriptor)

  if (!hasChecksum) {
    return { isValid: true } // No checksum to validate
  }

  const checksumMatch = descriptor.match(checksumRegex)
  if (!checksumMatch || !checksumMatch[0]) {
    return { isValid: false, error: 'checksumFormat' }
  }

  const providedChecksum = checksumMatch[0].substring(1) // Remove the #

  // Basic format validation - check if it's exactly 8 characters
  if (!/^[a-z0-9]{8}$/.test(providedChecksum)) {
    return { isValid: false, error: 'checksumFormat' }
  }

  // Use BDK to validate the checksum
  try {
    const { Descriptor } = require('bdk-rn')
    const { Network } = require('bdk-rn/lib/lib/enums')

    // Try to create a descriptor with BDK to validate checksum
    await new Descriptor().create(descriptor, Network.Bitcoin)
    return { isValid: true }
  } catch (error) {
    // If BDK throws an error, it's likely a checksum error
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (
      errorMessage.includes('checksum') ||
      errorMessage.includes('Checksum') ||
      errorMessage.includes('invalid')
    ) {
      return { isValid: false, error: 'checksumInvalid' }
    }
    // For other BDK errors, return a generic format error
    return { isValid: false, error: 'descriptorFormat' }
  }
}

export async function validateDescriptor(descriptor: string): Promise<{
  isValid: boolean
  error?: string
}> {
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
  // Use a more lenient regex to handle truncated checksums
  const checksumRegex = new RegExp(`#[a-z0-9]{1,8}$`)
  const nestedKindRegex = new RegExp(`^${nestedKind}\\(`)

  // main regex to parse the descriptor
  const singleKeyRegex = new RegExp(singleKey, 'gm')
  const multiKeyRegex = new RegExp(multiKey, 'gm')
  const nestedRegex = new RegExp(nestedDescriptor, 'gm')

  // Validate checksum first
  const checksumValidation = await validateDescriptorChecksum(descriptor)
  if (!checksumValidation.isValid) {
    return checksumValidation
  }

  // Remove checksum if any.
  // Nested descriptor have only 1 checksum, that is why we remove it first.
  // Because we remove it, we also do not need to check it again.
  let currentItem = descriptor.replace(checksumRegex, '')

  // Check for proper closing parenthesis
  if (!currentItem.endsWith(')')) {
    return { isValid: false, error: 'missingParenthesis' }
  }

  // Extract nested descriptor.
  // Example: wsh(sh(pkh(...))) -> pkh(...)
  while (nestedRegex.test(currentItem)) {
    // first, check if the current item is a single key sh/wsh descriptor
    if (singleKeyRegex.test(currentItem)) return { isValid: true }

    // extract it
    currentItem = currentItem.replace(nestedKindRegex, '').replace(/\)$/, '')
  }

  // Check for derivation path format in the current item
  const derivationPathMatch = currentItem.match(
    /\[([a-fA-F0-9]{8})?([0-9]+[h']?\/)*[0-9]+[h']?\]/
  )
  if (derivationPathMatch) {
    const derivationPath = derivationPathMatch[0]
    // Validate fingerprint if present
    const fingerprintMatch = derivationPath.match(/\[([a-fA-F0-9]{8})/)
    if (fingerprintMatch && fingerprintMatch[1]) {
      if (!/^[a-fA-F0-9]{8}$/.test(fingerprintMatch[1])) {
        return { isValid: false, error: 'fingerprintFormat' }
      }
    }

    // Validate derivation path components
    const pathComponents = derivationPath.match(/[0-9]+[h']?/g)
    if (pathComponents) {
      for (const component of pathComponents) {
        if (!/^[0-9]+[h']?$/.test(component)) {
          return { isValid: false, error: 'derivationPathComponent' }
        }
      }
    }
  }

  // It must be either single key or multi key
  const result =
    singleKeyRegex.test(currentItem) || multiKeyRegex.test(currentItem)

  // If the regex validation fails, try a more lenient approach for extended public keys
  if (!result) {
    // Check if it's a basic descriptor with extended public key
    const basicDescriptorPattern = new RegExp(
      `^${kind}\\(\\[([a-fA-F0-9]{8})?([0-9]+[h']?\\/)*[0-9]+[h']?\\][a-zA-Z0-9]+(\\/[0-9*])*\\)$`
    )
    if (basicDescriptorPattern.test(currentItem)) {
      return { isValid: true }
    }

    // Check for specific issues
    if (currentItem.includes('[') && !currentItem.includes(']')) {
      return { isValid: false, error: 'derivationPathBracket' }
    }

    if (currentItem.includes(']') && !currentItem.includes('[')) {
      return { isValid: false, error: 'unexpectedBracket' }
    }

    // Check for invalid script function
    const validScriptFunctions = [
      'sh',
      'wsh',
      'pk',
      'pkh',
      'wpkh',
      'combo',
      'tr',
      'addr',
      'raw',
      'rawtr',
      'multi',
      'sortedmulti'
    ]
    const foundScriptFunction = currentItem.match(
      /^(sh|wsh|pk|pkh|wpkh|combo|tr|addr|raw|rawtr|multi|sortedmulti)\(/
    )
    if (!foundScriptFunction) {
      return { isValid: false, error: 'scriptFunctionInvalid' }
    }

    return { isValid: false, error: 'descriptorFormat' }
  }

  return { isValid: true }
}

export function validateDescriptorScriptVersion(
  descriptor: string,
  scriptVersion: string
): { isValid: boolean; error?: string } {
  // Remove checksum if present
  const cleanDescriptor = descriptor.replace(/#[a-z0-9]{8}$/, '')

  // Extract the script type from the descriptor
  const scriptTypeMatch = cleanDescriptor.match(
    /^(sh|wsh|pk|pkh|wpkh|combo|tr|addr|raw|rawtr)\(/
  )
  if (!scriptTypeMatch) {
    return { isValid: false, error: 'Invalid descriptor format' }
  }

  const scriptType = scriptTypeMatch[1]

  // Define compatibility matrix
  const compatibilityMatrix: Record<string, string[]> = {
    P2PKH: ['pkh'],
    'P2SH-P2WPKH': ['sh'],
    P2WPKH: ['wpkh'],
    P2TR: ['tr']
  }

  // Check if the script type is compatible with the target script version
  const allowedScriptTypes = compatibilityMatrix[scriptVersion]
  if (!allowedScriptTypes) {
    return { isValid: false, error: `Unknown script version: ${scriptVersion}` }
  }

  if (!allowedScriptTypes.includes(scriptType)) {
    return {
      isValid: false,
      error: `Descriptor script type "${scriptType}" is not compatible with multisig script version "${scriptVersion}". Expected: ${allowedScriptTypes.join(', ')}`
    }
  }

  return { isValid: true }
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
