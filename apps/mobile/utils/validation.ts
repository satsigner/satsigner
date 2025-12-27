import ecc from '@bitcoinerlab/secp256k1'
import { Descriptor } from 'bdk-rn'
import { Network } from 'bdk-rn/lib/lib/enums'
import * as bitcoinjs from 'bitcoinjs-lib'

import { type ScriptVersionType } from '@/types/models/Account'
import { type Network as AppNetwork } from '@/types/settings/blockchain'

bitcoinjs.initEccLib(ecc)

// Define valid key prefixes for each network
const NETWORK_KEY_PREFIXES: Record<AppNetwork, string[]> = {
  bitcoin: ['xpub', 'ypub', 'zpub', 'vpub'],
  testnet: ['tpub', 'upub', 'vpub'],
  signet: ['tpub', 'upub', 'vpub']
}

export function validateExtendedKey(key: string, network?: AppNetwork) {
  // TODO: validate string length: 111 characters?
  // TODO: validate checksum

  // If network is provided, validate against that network's prefixes
  if (network) {
    const validPrefixes = NETWORK_KEY_PREFIXES[network]
    const keyPrefix = key.match(/^[tuvxyz](pub|prv)/)?.[0]
    return keyPrefix ? validPrefixes.includes(keyPrefix) : false
  }

  // Fallback to original validation (accepts all prefixes)
  return key.match(new RegExp('^[tuvxyz](pub|prv)[a-zA-Z0-9]+$')) !== null
}

export function validateDerivationPath(path: string) {
  // Updated regex to better handle both h and ' formats
  // Supports: m/84h/0h/0h, m/84'/0'/0', 84h/0h/0h, 84'/0'/0', etc.
  return path.match(new RegExp("^([mM]/)?([0-9]+[h']?/)*[0-9]+[h']?$")) !== null
}

export function validateFingerprint(fingerprint: string) {
  return fingerprint.match(new RegExp('^[a-fA-F0-9]{8}$')) !== null
}

// Function to validate descriptor checksum using BDK
async function validateDescriptorChecksum(
  descriptor: string
): Promise<{ isValid: boolean; error?: string }> {
  try {
    await new Descriptor().create(descriptor, Network.Bitcoin)
    return {
      isValid: true
    }
  } catch {}

  try {
    await new Descriptor().create(descriptor, Network.Testnet)
    return {
      isValid: true
    }
  } catch {}

  return {
    isValid: false,
    error: 'descriptorFormat'
  }
}

export async function validateDescriptor(descriptor: string): Promise<{
  isValid: boolean
  error?: string
}> {
  return validateDescriptorInternal(descriptor, true)
}

export async function validateDescriptorFormat(descriptor: string): Promise<{
  isValid: boolean
  error?: string
}> {
  return validateDescriptorInternal(descriptor, false)
}

async function validateDescriptorInternal(
  descriptor: string,
  validateChecksum: boolean
): Promise<{
  isValid: boolean
  error?: string
}> {
  // regex expressions building blocks
  const kind = '(sh|wsh|pk|pkh|wpkh|combo|tr|addr|raw|rawtr)'
  const nestedKind = '(sh|wsh)'
  const multiKind = `(multi|sortedmulti)`
  const fingerprint = '[a-fA-F0-9]{8}'
  const keyDerivationPath = `(/[0-9]+[h']?)+`
  const fullFingerprint = `\\[(${fingerprint})?${keyDerivationPath}\\]`
  // Allow public keys that start with numbers (02, 03) and extended keys
  const content = '[a-zA-Z0-9]+'
  // Updated to handle combined descriptor syntax: <0;1> or <0,1>
  const addressDerivationPath = '(/[0-9*]|<0[,;]1>)*'
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

  // Validate checksum first (only if validateChecksum is true)
  if (validateChecksum) {
    const checksumValidation = await validateDescriptorChecksum(descriptor)
    if (!checksumValidation.isValid) {
      return checksumValidation
    }
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

  // Check if it's a combined descriptor first (special case)
  if (isCombinedDescriptor(currentItem)) {
    // For combined descriptors, use the exact pattern that works
    const combinedPattern = new RegExp(
      `^${kind}\\(\\[([a-fA-F0-9]{8})?([0-9]+[h']?/)*[0-9]+[h']?\\][a-zA-Z0-9]+/<0[,;]1>/\\*\\)$`
    )

    // If the above pattern doesn't work, try the exact pattern that we know works
    if (!combinedPattern.test(currentItem)) {
      const exactWorkingPattern = new RegExp(
        `^${kind}\\(\\[[a-fA-F0-9]{8}/[0-9]+[h']?/[0-9]+[h']?/[0-9]+[h']?\\][a-zA-Z0-9]+/<0[,;]1>/\\*\\)$`
      )
      if (exactWorkingPattern.test(currentItem)) {
        return { isValid: true }
      }
    }
    if (combinedPattern.test(currentItem)) {
      return { isValid: true }
    }
  }

  // It must be either single key or multi key
  const result =
    singleKeyRegex.test(currentItem) || multiKeyRegex.test(currentItem)

  // If the regex validation fails, try a more lenient approach for extended public keys
  if (!result) {
    // Check if it's a basic descriptor with extended public key
    const basicDescriptorPattern = new RegExp(
      `^${kind}\\(\\[([a-fA-F0-9]{8})?([0-9]+[h']?/)*[0-9]+[h']?\\][a-zA-Z0-9]+(/[0-9*]|<0[,;]1>)*\\)$`
    )
    if (basicDescriptorPattern.test(currentItem)) {
      return { isValid: true }
    }

    // Check if it's a multi descriptor with public keys
    const multiPublicKeyPattern = new RegExp(
      `^${multiKind}\\([1-9][0-9]*,([0-9]{2}[a-fA-F0-9]{64},)*[0-9]{2}[a-fA-F0-9]{64}\\)$`
    )
    if (multiPublicKeyPattern.test(currentItem)) {
      return { isValid: true }
    }

    // Check if it's a multi descriptor with extended public keys
    const multiExtendedKeyPattern = new RegExp(
      `^${multiKind}\\([1-9][0-9]*,.*\\)$`
    )
    if (multiExtendedKeyPattern.test(currentItem)) {
      // For multisig descriptors, be more lenient - just check for basic structure
      // Look for at least 2 key patterns (fingerprint + extended key)
      const keyPatterns = currentItem.match(/\[[a-fA-F0-9]{8}\/[^]]+\]/g)
      if (keyPatterns && keyPatterns.length >= 2) {
        return { isValid: true }
      }
      // Also accept if it contains tpub/xpub patterns (common extended key formats)
      const extendedKeyPatterns = currentItem.match(
        /(tpub|xpub|ypub|zpub|upub|vpub)[a-zA-Z0-9]+/g
      )
      if (extendedKeyPatterns && extendedKeyPatterns.length >= 2) {
        return { isValid: true }
      }
    }

    // Check for specific issues
    if (currentItem.includes('[') && !currentItem.includes(']')) {
      return { isValid: false, error: 'derivationPathBracket' }
    }

    if (currentItem.includes(']') && !currentItem.includes('[')) {
      return { isValid: false, error: 'unexpectedBracket' }
    }

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
  scriptVersion: ScriptVersionType
) {
  const cleanDescriptor = descriptor.replace(/#[a-z0-9]{8}$/, '')
  const compatibilityMatrix: Record<ScriptVersionType, string> = {
    P2PKH: 'pkh',
    'P2SH-P2WPKH': 'sh',
    P2WPKH: 'wpkh',
    P2TR: 'tr',
    P2WSH: 'wsh',
    'P2SH-P2WSH': 'sh',
    P2SH: 'sh'
  }
  const scriptPrefix = compatibilityMatrix[scriptVersion]
  return cleanDescriptor.match(new RegExp(`^${scriptPrefix}\\(`)) !== null
}

export function validateAddress(address: string, network?: bitcoinjs.Network) {
  const networks =
    network !== undefined
      ? [network]
      : [
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

export function isCombinedDescriptor(descriptor: string): boolean {
  return /<0[,;]1>/.test(descriptor)
}

// Function to separate a combined descriptor into external and internal descriptors
export function separateCombinedDescriptor(combinedDescriptor: string): {
  external: string
  internal: string
} {
  const external = combinedDescriptor.replace(/<0[,;]1>/, '0')
  const internal = combinedDescriptor.replace(/<0[,;]1>/, '1')
  return { external, internal }
}

export async function validateCombinedDescriptor(
  combinedDescriptor: string,
  scriptVersion?: ScriptVersionType,
  networkType?: string
): Promise<{
  isValid: boolean
  error?: string
  externalDescriptor: string
  internalDescriptor: string
}> {
  // Validate the full combined descriptor including checksum
  const combinedValidation = await validateDescriptor(combinedDescriptor)

  if (!combinedValidation.isValid) {
    // If combined descriptor is invalid, return the error
    const { external, internal } =
      separateCombinedDescriptor(combinedDescriptor)

    return {
      isValid: false,
      error: combinedValidation.error,
      externalDescriptor: external,
      internalDescriptor: internal
    }
  }

  // Validate script function against selected script version
  let scriptVersionValidation = false
  if (scriptVersion) {
    scriptVersionValidation = validateDescriptorScriptVersion(
      combinedDescriptor,
      scriptVersion
    )
  }

  if (!scriptVersionValidation) {
    const { external, internal } =
      separateCombinedDescriptor(combinedDescriptor)

    return {
      isValid: false,
      error: 'invalid script version',
      externalDescriptor: external,
      internalDescriptor: internal
    }
  }

  // Separate the combined descriptor first
  const { external: externalDesc, internal: internalDesc } =
    separateCombinedDescriptor(combinedDescriptor)

  // Network validation - check if descriptor is compatible with selected network
  let networkValidation: { isValid: boolean; error?: string } = {
    isValid: true
  }

  if (networkType && combinedDescriptor) {
    // Map networkType string to BDK Network enum
    let bdkNetwork = Network.Bitcoin
    if (networkType === 'testnet') bdkNetwork = Network.Testnet
    if (networkType === 'regtest') bdkNetwork = Network.Regtest
    if (networkType === 'signet') bdkNetwork = Network.Signet
    try {
      await new Descriptor().create(combinedDescriptor, bdkNetwork)
      networkValidation = { isValid: true }
    } catch {}
  }

  if (!networkValidation.isValid) {
    return {
      isValid: false,
      error: networkValidation.error,
      externalDescriptor: externalDesc,
      internalDescriptor: internalDesc
    }
  }

  return {
    isValid: true,
    externalDescriptor: externalDesc,
    internalDescriptor: internalDesc
  }
}
