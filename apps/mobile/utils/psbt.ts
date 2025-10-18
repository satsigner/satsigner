import * as ecc from '@bitcoinerlab/secp256k1'
import BIP32Factory from 'bip32'
import * as bip39 from 'bip39'
import * as bitcoinjs from 'bitcoinjs-lib'
import { toast } from 'sonner-native'

import { type Account } from '@/types/models/Account'
import { extractKeyFingerprint } from '@/utils/account'
import { bitcoinjsNetwork } from '@/utils/bitcoin'

// Initialize BIP32 with elliptic curve
const bip32 = BIP32Factory(ecc)

// Configure bitcoinjs-lib to use the React Native compatible elliptic curve library
bitcoinjs.initEccLib(ecc)

export type TransactionData = {
  combinedPsbt: string
}

export type AccountMatchResult = {
  account: Account
  cosignerIndex: number
  fingerprint: string
  derivationPath: string
  publicKey: string
}

export type SigningResult = {
  success: boolean
  originalPSBT?: string
  signedPSBT?: string
  inputIndex?: number
  inputIndices?: number[]
  publicKey?: string
  privateKey?: string
  fingerprint?: string
  path?: string
  signature?: string
  signedInputsCount?: number
  validation?: any
  error?: string
}

type PsbtInput = {
  witnessUtxo?: {
    script: Buffer
    value: number
  }
  nonWitnessUtxo?: Buffer
}

export type ExtractedTransactionData = {
  inputs: {
    txid: string
    vout: number
    value: number
    script: string
    address?: string
    label?: string
    keychain?: 'internal' | 'external'
  }[]
  outputs: {
    address: string
    value: number
    script: string
    label?: string
  }[]
  fee: number
  network: 'mainnet' | 'testnet' | 'signet'
}

export function extractPSBTDerivations(psbtBase64: string): {
  fingerprint: string
  derivationPath: string
  publicKey: string
  inputIndex: number
}[] {
  try {
    const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
    const derivations: {
      fingerprint: string
      derivationPath: string
      publicKey: string
      inputIndex: number
    }[] = []

    psbt.data.inputs.forEach((input, inputIndex) => {
      if (input.bip32Derivation) {
        input.bip32Derivation.forEach((derivation) => {
          const fingerprint = derivation.masterFingerprint.toString('hex')
          const derivationPath = derivation.path
          const publicKey = derivation.pubkey.toString('hex')

          derivations.push({
            fingerprint,
            derivationPath,
            publicKey,
            inputIndex
          })
        })
      }
    })

    return derivations
  } catch {
    return []
  }
}

export function findMatchingAccount(
  psbtBase64: string,
  accounts: Account[]
): AccountMatchResult | null {
  try {
    const derivations = extractPSBTDerivations(psbtBase64)

    if (derivations.length === 0) {
      return null
    }

    const psbtFingerprints = [...new Set(derivations.map((d) => d.fingerprint))]

    for (const account of accounts) {
      if (!account.keys || account.keys.length === 0) {
        continue
      }

      const accountFingerprints: string[] = []
      const keyFingerprintMap = new Map<string, number>()

      for (let keyIndex = 0; keyIndex < account.keys.length; keyIndex++) {
        const key = account.keys[keyIndex]
        const keyFingerprint = extractKeyFingerprint(key)

        if (keyFingerprint) {
          accountFingerprints.push(keyFingerprint)
          keyFingerprintMap.set(keyFingerprint, keyIndex)
        }
      }

      const allFingerprintsMatch = psbtFingerprints.every((psbtFp) =>
        accountFingerprints.includes(psbtFp)
      )

      if (allFingerprintsMatch) {
        const firstMatchingDerivation = derivations.find((d) =>
          accountFingerprints.includes(d.fingerprint)
        )

        if (firstMatchingDerivation) {
          const matchingKeyIndex = keyFingerprintMap.get(
            firstMatchingDerivation.fingerprint
          )!
          return {
            account,
            cosignerIndex: matchingKeyIndex,
            fingerprint: firstMatchingDerivation.fingerprint,
            derivationPath: firstMatchingDerivation.derivationPath,
            publicKey: firstMatchingDerivation.publicKey
          }
        }
      }
    }

    return null
  } catch {
    return null
  }
}

const transactionDataStorage = new Map<string, TransactionData>()

export function storeTransactionData(data: TransactionData): void {
  const txId = extractTransactionIdFromPSBT(data.combinedPsbt)
  if (txId) {
    transactionDataStorage.set(txId, data)
  }
}

/**
 * Sign PSBT with seed words
 * @param psbtBase64 - The PSBT in base64 format
 * @param seedWords - Space-separated seed words
 * @param scriptType - Script type ('P2WSH', 'P2SH', 'P2SH-P2WSH')
 * @returns Signing result
 */
export function signPSBTWithSeed(
  psbtBase64: string,
  seedWords: string,
  scriptType: 'P2WSH' | 'P2SH' | 'P2SH-P2WSH' = 'P2WSH'
): SigningResult {
  try {
    const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)

    const mnemonic = seedWords.trim()
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic')
    }

    // Derive seed and root key
    const seed = bip39.mnemonicToSeedSync(mnemonic)
    const root = bip32.fromSeed(new Uint8Array(seed))

    const seedFingerprint = Buffer.from(
      root.fingerprint || Buffer.alloc(4)
    ).toString('hex')

    // Find BIP32 derivations in PSBT
    const derivations: {
      inputIndex: number
      pubkey: string
      fingerprint: string
      path: string
    }[] = []

    psbt.data.inputs.forEach((input, inputIndex) => {
      if (input.bip32Derivation) {
        input.bip32Derivation.forEach((derivation) => {
          derivations.push({
            inputIndex,
            pubkey: derivation.pubkey.toString('hex'),
            fingerprint: derivation.masterFingerprint.toString('hex'),
            path: derivation.path
          })
        })
      }
    })

    // Find ALL matching derivations for our seed (not just the first one)
    const matchingDerivations = derivations.filter(
      (derivation) => derivation.fingerprint === seedFingerprint
    )

    if (matchingDerivations.length === 0) {
      throw new Error(
        `No matching derivation found for fingerprint: ${seedFingerprint}`
      )
    }

    let signedInputs = 0
    for (const derivation of matchingDerivations) {
      const derivedKey = root.derivePath(derivation.path)
      const privateKey = derivedKey.privateKey
        ? Buffer.from(derivedKey.privateKey).toString('hex')
        : Buffer.alloc(32).toString('hex')
      const publicKey = Buffer.from(derivedKey.publicKey).toString('hex')

      if (publicKey !== derivation.pubkey) {
        if (derivedKey.privateKey) {
          derivedKey.privateKey.fill(0)
        }
        continue
      }

      const signer = {
        publicKey: Buffer.from(publicKey, 'hex'),
        sign: (hash: Buffer) => {
          const privateKeyBuffer = new Uint8Array(
            Buffer.from(privateKey, 'hex')
          )
          const signature = ecc.sign(new Uint8Array(hash), privateKeyBuffer)
          privateKeyBuffer.fill(0)
          return Buffer.from(signature)
        }
      }

      if (derivedKey.privateKey) {
        derivedKey.privateKey.fill(0)
      }
      const inputData = psbt.data.inputs[derivation.inputIndex]

      switch (scriptType) {
        case 'P2WSH':
          if (!inputData.witnessScript) {
            continue
          }
          break

        case 'P2SH':
          if (!inputData.redeemScript) {
            continue
          }
          break

        case 'P2SH-P2WSH':
          if (!inputData.redeemScript) {
            continue
          }
          if (!inputData.witnessScript) {
            continue
          }
          break

        default:
      }

      try {
        psbt.signInput(derivation.inputIndex, signer)
        signedInputs++

        const input = psbt.data.inputs[derivation.inputIndex]
        if (!input.partialSig || input.partialSig.length === 0) {
        }
      } catch {
        continue
      }
    }

    if (signedInputs === 0) {
      throw new Error('Failed to sign any inputs')
    }

    const signedPSBT = psbt.toBase64()

    if (root.privateKey) {
      root.privateKey.fill(0)
    }

    const validation = getSignedPSBTValidationInfo(signedPSBT)

    return {
      success: true,
      originalPSBT: psbtBase64,
      signedPSBT,
      inputIndex: matchingDerivations[0].inputIndex,
      inputIndices: matchingDerivations.map((d) => d.inputIndex),
      publicKey: matchingDerivations[0].pubkey,
      privateKey: '',
      fingerprint: seedFingerprint,
      path: matchingDerivations[0].path,
      signature:
        psbt.data.inputs[
          matchingDerivations[0].inputIndex
        ].partialSig?.[0]?.signature?.toString('hex') || '',
      signedInputsCount: signedInputs,
      validation
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Validate a signed PSBT
 * @param signedPSBT - The signed PSBT in base64 format
 * @returns Validation results
 */
export function getSignedPSBTValidationInfo(signedPSBT: string) {
  try {
    const psbt = bitcoinjs.Psbt.fromBase64(signedPSBT)
    const validation = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
      signatures: [] as {
        inputIndex: number
        pubkey: string
        signature: string
      }[],
      inputs: [] as {
        index: number
        hasPartialSigs: boolean
        partialSigs: {
          pubkey: string
          signature: string
        }[]
        hasWitnessUtxo: boolean
        hasNonWitnessUtxo: boolean
        hasBip32Derivation: boolean
      }[]
    }

    // Check each input for signatures
    psbt.data.inputs.forEach((input, inputIndex) => {
      const inputInfo = {
        index: inputIndex,
        hasPartialSigs: false,
        partialSigs: [] as {
          pubkey: string
          signature: string
        }[],
        hasWitnessUtxo: !!input.witnessUtxo,
        hasNonWitnessUtxo: !!input.nonWitnessUtxo,
        hasBip32Derivation: !!input.bip32Derivation
      }

      // Check for partial signatures
      if (input.partialSig && input.partialSig.length > 0) {
        inputInfo.hasPartialSigs = true
        input.partialSig.forEach((sig) => {
          inputInfo.partialSigs.push({
            pubkey: sig.pubkey.toString('hex'),
            signature: sig.signature.toString('hex')
          })
          validation.signatures.push({
            inputIndex,
            pubkey: sig.pubkey.toString('hex'),
            signature: sig.signature.toString('hex')
          })
        })
      } else {
        validation.warnings.push(
          `Input ${inputIndex} has no partial signatures`
        )
      }

      validation.inputs.push(inputInfo)
    })

    return validation
  } catch (error) {
    return {
      isValid: false,
      errors: [
        `Failed to parse PSBT: ${error instanceof Error ? error.message : 'Unknown error'}`
      ],
      warnings: [] as string[],
      signatures: [] as {
        inputIndex: number
        pubkey: string
        signature: string
      }[],
      inputs: [] as {
        index: number
        hasPartialSigs: boolean
        partialSigs: {
          pubkey: string
          signature: string
        }[]
        hasWitnessUtxo: boolean
        hasNonWitnessUtxo: boolean
        hasBip32Derivation: boolean
      }[]
    }
  }
}

/**
 * Extract transaction ID from PSBT
 */
export function extractTransactionIdFromPSBT(
  psbtBase64: string
): string | null {
  try {
    const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)

    try {
      const tx = psbt.extractTransaction()
      return tx.getId()
    } catch {
      const unsignedTx = psbt.data.globalMap.unsignedTx
      if (unsignedTx) {
        const txBuffer = unsignedTx.toBuffer()
        const hash = bitcoinjs.crypto.hash256(txBuffer)
        return hash.reverse().toString('hex')
      }
    }
  } catch {
    return null
  }
  return null
}

/**
 * Extract transaction data from PSBT for sankey chart visualization
 * Gets inputs/outputs directly from PSBT structure instead of raw message content
 */
export function extractTransactionDataFromPSBTEnhanced(
  psbtBase64: string,
  account: Account
): ExtractedTransactionData | null {
  try {
    if (!psbtBase64 || !account) return null

    const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
    const network = bitcoinjsNetwork(account.network)

    const inputs = psbt.data.inputs.map((input, index) => {
      const psbtInput = input as PsbtInput
      const txInput = psbt.txInputs[index]
      const txid = txInput.hash.reverse().toString('hex')
      const vout = txInput.index

      let value = 0
      let script = ''
      let address = ''

      if (psbtInput.witnessUtxo) {
        value = psbtInput.witnessUtxo.value
        script = psbtInput.witnessUtxo.script?.toString('hex') || ''
      } else if (psbtInput.nonWitnessUtxo) {
        try {
          const prevTx = bitcoinjs.Transaction.fromBuffer(
            psbtInput.nonWitnessUtxo
          )
          const prevOut = prevTx.outs[vout]
          value = prevOut?.value || 0
          script = prevOut?.script?.toString('hex') || ''
        } catch {
          value = 0
        }
      }

      try {
        if (script) {
          address = bitcoinjs.address.fromOutputScript(
            Buffer.from(script, 'hex'),
            network
          )
        }
      } catch {
        address = `Unknown Input ${index + 1}`
      }

      return {
        txid,
        vout,
        value,
        script,
        address,
        label: `Input ${index + 1}`,
        keychain: 'external' as const
      }
    })

    const outputs = psbt.txOutputs.map((output, index) => {
      const script = output.script.toString('hex')
      const value = output.value
      let address = ''

      try {
        address = bitcoinjs.address.fromOutputScript(
          Buffer.from(script, 'hex'),
          network
        )
      } catch {
        address = `Unknown Address ${index + 1}`
      }

      return {
        address,
        value,
        script,
        label: `Output ${index + 1}`
      }
    })

    const totalInputValue = inputs.reduce(
      (sum, input) => sum + (input.value || 0),
      0
    )
    const totalOutputValue = outputs.reduce(
      (sum, output) => sum + (output.value || 0),
      0
    )
    const fee = Math.max(totalInputValue - totalOutputValue, 0)

    return {
      inputs,
      outputs,
      fee,
      network: (account.network === 'bitcoin' ? 'mainnet' : account.network) as
        | 'mainnet'
        | 'testnet'
        | 'signet'
    }
  } catch {
    return null
  }
}

// Function to combine multiple base64 PSBTs
export function combinePsbts(psbtBase64s: string[]): string {
  if (psbtBase64s.length === 0) {
    throw new Error('No PSBTs provided to combine.')
  }

  const basePsbt = bitcoinjs.Psbt.fromBase64(psbtBase64s[0])

  for (let i = 1; i < psbtBase64s.length; i++) {
    const nextPsbt = bitcoinjs.Psbt.fromBase64(psbtBase64s[i])
    basePsbt.combine(nextPsbt)
  }

  return basePsbt.toBase64()
}

// Function to reconstruct the original (unsigned) PSBT
export function extractOriginalPsbt(psbtBase64: string): string {
  const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
  const tx = bitcoinjs.Transaction.fromBuffer(
    psbt.data.globalMap.unsignedTx.toBuffer()
  )

  const newPsbt = new bitcoinjs.Psbt()
  newPsbt.setVersion(tx.version)
  newPsbt.setLocktime(tx.locktime)

  psbt.txInputs.forEach((input) => {
    newPsbt.addInput({
      hash: input.hash,
      index: input.index,
      sequence: input.sequence
    })
  })

  psbt.txOutputs.forEach((output) => {
    newPsbt.addOutput({
      script: output.script,
      value: output.value
    })
  })

  psbt.data.inputs.forEach((input, index) => {
    const {
      partialSig: _partialSig,
      finalScriptSig: _finalScriptSig,
      finalScriptWitness: _finalScriptWitness,
      ...nonSignatureData
    } = input
    newPsbt.updateInput(index, nonSignatureData)
  })

  psbt.data.outputs.forEach((output, index) => {
    newPsbt.updateOutput(index, output)
  })

  return newPsbt.toBase64()
}

export function getMultisigInfoFromPsbt(psbtBase64: string): {
  required: number
  total: number
} | null {
  const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
  if (psbt.data.inputs.length === 0) return null

  const firstInput = psbt.data.inputs[0]
  const script = firstInput.witnessScript || firstInput.redeemScript

  if (!script) return null

  try {
    const decompiled = bitcoinjs.script.decompile(script)
    if (!decompiled || decompiled.length < 4) return null

    const mOp = decompiled[0]
    const nOp = decompiled[decompiled.length - 2]

    const m = bitcoinjs.script.number.decode(
      Buffer.isBuffer(mOp) ? mOp : Buffer.from([mOp - 80])
    )
    const n = bitcoinjs.script.number.decode(
      Buffer.isBuffer(nOp) ? nOp : Buffer.from([nOp - 80])
    )

    return { required: m, total: n }
  } catch {
    return null
  }
}

// Function to get the set of unique public keys that have signed
export function getCollectedSignerPubkeys(psbtBase64: string): Set<string> {
  const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)

  const signerPubkeys = new Set<string>()

  if (psbt.data.inputs) {
    for (const input of psbt.data.inputs) {
      if (input.partialSig && input.partialSig.length > 0) {
        for (const sig of input.partialSig) {
          signerPubkeys.add(sig.pubkey.toString('hex'))
        }
      }
    }
  }

  return signerPubkeys
}

// Function to extract individual signed PSBTs from a combined PSBT
export function extractIndividualSignedPsbts(
  combinedPsbtBase64: string,
  originalPsbtBase64: string
): Record<number, string> {
  try {
    const combinedPsbt = bitcoinjs.Psbt.fromBase64(combinedPsbtBase64)

    const individualSignedPsbts: Record<number, string> = {}

    const signerPubkeys = getCollectedSignerPubkeys(combinedPsbtBase64)
    const signerPubkeyArray = Array.from(signerPubkeys)

    signerPubkeyArray.forEach((pubkey, index) => {
      const individualPsbt = bitcoinjs.Psbt.fromBase64(originalPsbtBase64)

      combinedPsbt.data.inputs.forEach((input, inputIndex) => {
        if (input.partialSig && input.partialSig.length > 0) {
          const signerSigs = input.partialSig.filter(
            (sig) => sig.pubkey.toString('hex') === pubkey
          )

          if (signerSigs.length > 0) {
            individualPsbt.updateInput(inputIndex, {
              partialSig: signerSigs
            })
          }
        }
      })

      individualSignedPsbts[index] = individualPsbt.toBase64()
    })

    return individualSignedPsbts
  } catch {
    return {}
  }
}

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
    if (!validateSignedPSBT(psbtBase64, account)) {
      return false
    }

    if (account.policyType !== 'multisig') {
      return true
    }

    if (!account.keys || !account.keys[cosignerIndex]) {
      return true
    }

    const selectedAccountKey = account.keys[cosignerIndex]

    const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)

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

function validateInput(input: any): boolean {
  if (!input.witnessUtxo && !input.nonWitnessUtxo) {
    return false
  }

  if (input.witnessUtxo && !isValidWitnessUtxo(input.witnessUtxo)) {
    return false
  }

  if (input.nonWitnessUtxo && !isValidNonWitnessUtxo(input.nonWitnessUtxo)) {
    return false
  }

  return true
}

function validateOutput(output: any): boolean {
  return !!output
}

function isValidWitnessUtxo(witnessUtxo: any): boolean {
  return !!(
    witnessUtxo.script &&
    witnessUtxo.value !== undefined &&
    witnessUtxo.value > 0
  )
}

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

function countPublicKeysInScript(script: any[]): number {
  return script.filter(
    (item) =>
      item &&
      typeof item === 'object' &&
      (Buffer.isBuffer(item) || (item as any).type === 'Buffer')
  ).length
}

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

function countSignatures(partialSig: any[] | any): number {
  if (!partialSig) {
    return 0
  }
  return Array.isArray(partialSig) ? partialSig.length : 1
}

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
    const cosignerPublicKey = extractCosignerPublicKey(psbt, cosignerKey)

    if (!cosignerPublicKey) {
      return false
    }

    const hasSignature = checkSignatureForPublicKey(psbt, cosignerPublicKey)

    return hasSignature
  } catch {
    toast.error('Error validating cosigner signature')
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
  if (typeof cosignerKey.secret === 'string') {
    return extractPublicKeyFromEncryptedKey(psbt, cosignerKey)
  }

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
