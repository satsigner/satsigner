import * as bitcoinjs from 'bitcoinjs-lib'

import { type Account } from '@/types/models/Account'

/**
 * Main PSBT validator that checks basic PSBT structure and signature validation
 * @param psbtBase64 - Base64 encoded PSBT
 * @param account - Account with keys for validation
 * @returns true if validation passes, false otherwise
 */
export function validateSignedPSBT(
  psbtBase64: string,
  account: Account
): boolean {
  try {
    const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)

    // Early returns for basic structure validation
    if (!hasValidStructure(psbt)) {
      return false
    }

    if (!validateInputsAndOutputs(psbt)) {
      return false
    }

    // Route to appropriate validation based on account type
    return account.policyType === 'multisig'
      ? validateMultisigPSBT(psbt)
      : validateSinglesigPSBT(psbt)
  } catch {
    return false
  }
}

/**
 * Validate signed PSBT for a specific cosigner in multisig
 * @param psbtBase64 - Base64 encoded PSBT
 * @param account - Account with keys for validation
 * @param cosignerIndex - Index of the specific cosigner to validate for
 * @param decryptedKey - Optional decrypted key object for the cosigner
 * @returns true if validation passes for the specific cosigner
 */
export function validateSignedPSBTForCosigner(
  psbtBase64: string,
  account: Account,
  cosignerIndex: number,
  decryptedKey?: any
): boolean {
  try {
    // Early return if basic validation fails
    if (!validateSignedPSBT(psbtBase64, account)) {
      return false
    }

    // Early return for non-multisig accounts
    if (account.policyType !== 'multisig') {
      return true
    }

    // Early return if no keys or invalid cosigner index
    if (!account.keys || !account.keys[cosignerIndex]) {
      return true
    }

    const selectedAccountKey = account.keys[cosignerIndex]

    const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)

    // Use decrypted key if available, otherwise fall back to account key
    const keyToUse = decryptedKey || selectedAccountKey

    return validateCosignerSignature(psbt, keyToUse)
  } catch {
    return false
  }
}

/**
 * Check if PSBT has valid basic structure
 */
function hasValidStructure(psbt: bitcoinjs.Psbt): boolean {
  return !!(
    psbt.data.inputs &&
    psbt.data.inputs.length > 0 &&
    psbt.data.outputs &&
    psbt.data.outputs.length > 0
  )
}

/**
 * Validate multisig PSBT structure and signatures
 */
function validateMultisigPSBT(psbt: bitcoinjs.Psbt): boolean {
  try {
    return psbt.data.inputs.every(validateMultisigInput)
  } catch {
    return false
  }
}

/**
 * Validate single-sig PSBT structure
 */
function validateSinglesigPSBT(psbt: bitcoinjs.Psbt): boolean {
  try {
    return psbt.data.inputs.every(validateSinglesigInput)
  } catch {
    return false
  }
}

/**
 * Validate a single multisig input
 */
function validateMultisigInput(input: any): boolean {
  // Early returns for required fields
  if (!input.witnessScript) {
    return false
  }

  if (!input.witnessUtxo && !input.nonWitnessUtxo) {
    return false
  }

  const scriptInfo = parseWitnessScript(input.witnessScript)
  if (!scriptInfo) {
    return false
  }

  if (!isValidScriptInfo(scriptInfo)) {
    return false
  }

  const signatureCount = countSignatures(input.partialSig)
  if (!isValidMultisigSignatureCount(signatureCount, scriptInfo.totalKeys)) {
    return false
  }

  return validateSignatureFormat(input.partialSig)
}

/**
 * Validate a single single-sig input
 */
function validateSinglesigInput(input: any): boolean {
  // Early returns for required fields
  if (!input.witnessUtxo && !input.nonWitnessUtxo) {
    return false
  }

  if (input.witnessScript) {
    return false
  }

  const signatureCount = countSignatures(input.partialSig)
  if (signatureCount !== 1) {
    return false
  }

  return validateSignatureFormat(input.partialSig)
}

/**
 * Validate inputs and outputs structure
 */
function validateInputsAndOutputs(psbt: bitcoinjs.Psbt): boolean {
  try {
    const inputsValid = psbt.data.inputs.every(validateInput)
    const outputsValid = psbt.data.outputs.every(validateOutput)
    return inputsValid && outputsValid
  } catch {
    return false
  }
}

/**
 * Validate a single input
 */
function validateInput(input: any): boolean {
  // Early return if no UTXO data
  if (!input.witnessUtxo && !input.nonWitnessUtxo) {
    return false
  }

  // Validate witness UTXO if present
  if (input.witnessUtxo && !isValidWitnessUtxo(input.witnessUtxo)) {
    return false
  }

  // Validate non-witness UTXO if present
  if (input.nonWitnessUtxo && !isValidNonWitnessUtxo(input.nonWitnessUtxo)) {
    return false
  }

  return true
}

/**
 * Validate a single output
 */
function validateOutput(output: any): boolean {
  return !!output
}

/**
 * Validate witness UTXO structure
 */
function isValidWitnessUtxo(witnessUtxo: any): boolean {
  return !!(
    witnessUtxo.script &&
    witnessUtxo.value !== undefined &&
    witnessUtxo.value > 0
  )
}

/**
 * Validate non-witness UTXO structure
 */
function isValidNonWitnessUtxo(nonWitnessUtxo: any): boolean {
  return !!(nonWitnessUtxo && nonWitnessUtxo.length > 0)
}

/**
 * Parse witness script to extract threshold and public key information
 */
function parseWitnessScript(
  witnessScript: Buffer
): { threshold: number; totalKeys: number } | null {
  try {
    const script = bitcoinjs.script.decompile(witnessScript)
    if (!script || script.length < 3) {
      return null
    }

    const op = script[0]
    if (!isValidOpCode(op)) {
      return null
    }

    const threshold = (op as number) - 80
    const totalKeys = countPublicKeysInScript(script)

    return { threshold, totalKeys }
  } catch {
    return null
  }
}

/**
 * Check if op code is valid for multisig
 */
function isValidOpCode(op: any): boolean {
  return typeof op === 'number' && op >= 81 && op <= 96
}

/**
 * Count public keys in script
 */
function countPublicKeysInScript(script: any[]): number {
  return script.filter(
    (item) =>
      item &&
      typeof item === 'object' &&
      (Buffer.isBuffer(item) || (item as any).type === 'Buffer')
  ).length
}

/**
 * Check if script info is valid
 */
function isValidScriptInfo(scriptInfo: {
  threshold: number
  totalKeys: number
}): boolean {
  return !!(
    scriptInfo.threshold > 0 &&
    scriptInfo.totalKeys > 0 &&
    scriptInfo.threshold <= scriptInfo.totalKeys
  )
}

/**
 * Check if multisig signature count is valid
 */
function isValidMultisigSignatureCount(
  signatureCount: number,
  totalKeys: number
): boolean {
  return signatureCount > 0 && signatureCount <= totalKeys
}

/**
 * Count signatures in partialSig array
 */
function countSignatures(partialSig: any[] | any): number {
  if (!partialSig) {
    return 0
  }
  return Array.isArray(partialSig) ? partialSig.length : 1
}

/**
 * Validate signature format (basic checks)
 */
function validateSignatureFormat(partialSig: any[] | any): boolean {
  if (!partialSig) {
    return true
  }

  const sigs = Array.isArray(partialSig) ? partialSig : [partialSig]

  return sigs.every(isValidSignature)
}

/**
 * Check if a single signature is valid
 */
function isValidSignature(sig: any): boolean {
  if (!sig.pubkey || !sig.signature) {
    return false
  }

  const sigLength = sig.signature.length
  return sigLength >= 64 && sigLength <= 72
}

/**
 * Validate that a signed PSBT contains signatures from the specific cosigner
 */
function validateCosignerSignature(
  psbt: bitcoinjs.Psbt,
  cosignerKey: any
): boolean {
  try {
    // Get the cosigner's public key from the account
    const cosignerPublicKey = extractCosignerPublicKey(psbt, cosignerKey)

    if (!cosignerPublicKey) {
      return false
    }

    // Check if the PSBT contains signatures from this specific cosigner's public key
    const hasSignature = checkSignatureForPublicKey(psbt, cosignerPublicKey)

    return hasSignature
  } catch (_error) {
    return false
  }
}

/**
 * Extract cosigner public key from key details and PSBT derivations
 */
function extractCosignerPublicKey(
  psbt: bitcoinjs.Psbt,
  cosignerKey: any
): string {
  // Handle encrypted keys - if secret is a string, we can't decrypt it here
  // so we need to rely on BIP32 derivations in the PSBT
  if (typeof cosignerKey.secret === 'string') {
    return extractPublicKeyFromEncryptedKey(psbt, cosignerKey)
  }

  // Handle decrypted keys - ALWAYS use the inner fingerprint from the secret
  if (typeof cosignerKey.secret === 'object') {
    return extractPublicKeyFromDecryptedKey(psbt, cosignerKey)
  }

  return ''
}

function extractPublicKeyFromEncryptedKey(
  psbt: bitcoinjs.Psbt,
  cosignerKey: any
): string {
  const cosignerFingerprint = cosignerKey.fingerprint
  if (!cosignerFingerprint) {
    return ''
  }

  return findDerivedPublicKey(psbt, cosignerFingerprint)
}

function extractPublicKeyFromDecryptedKey(
  psbt: bitcoinjs.Psbt,
  cosignerKey: any
): string {
  const innerFingerprint = cosignerKey.secret.fingerprint
  if (!innerFingerprint) {
    return ''
  }

  return findDerivedPublicKey(psbt, innerFingerprint)
}

/**
 * Find public key from BIP32 derivations matching fingerprint
 */
function findDerivedPublicKey(
  psbt: bitcoinjs.Psbt,
  fingerprint: string
): string {
  for (let inputIndex = 0; inputIndex < psbt.data.inputs.length; inputIndex++) {
    const input = psbt.data.inputs[inputIndex]
    const publicKey = findPublicKeyInInput(input, fingerprint)
    if (publicKey) {
      return publicKey
    }
  }

  return ''
}

function findPublicKeyInInput(input: any, fingerprint: string): string {
  if (!input.bip32Derivation) {
    return ''
  }

  for (
    let derivIndex = 0;
    derivIndex < input.bip32Derivation.length;
    derivIndex++
  ) {
    const derivation = input.bip32Derivation[derivIndex]
    const derivationFingerprint = derivation.masterFingerprint.toString('hex')

    if (derivationFingerprint === fingerprint) {
      return derivation.pubkey.toString('hex')
    }
  }

  return ''
}

/**
 * Check if PSBT contains signatures from a specific public key
 */
function checkSignatureForPublicKey(
  psbt: bitcoinjs.Psbt,
  publicKey: string
): boolean {
  return psbt.data.inputs.some((input) =>
    hasSignatureFromPublicKey(input, publicKey)
  )
}

/**
 * Check if input has signature from specific public key
 */
function hasSignatureFromPublicKey(input: any, publicKey: string): boolean {
  if (!input.partialSig || input.partialSig.length === 0) {
    return false
  }

  const signatures = Array.isArray(input.partialSig)
    ? input.partialSig
    : [input.partialSig]

  return signatures.some((sig: any) => {
    if (!sig.pubkey) {
      return false
    }
    const sigPublicKey = sig.pubkey.toString('hex')
    return sigPublicKey === publicKey
  })
}
