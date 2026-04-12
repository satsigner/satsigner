import * as ecc from '@bitcoinerlab/secp256k1'
import BIP32Factory from 'bip32'
import * as bip39 from 'bip39'
import * as bitcoinjs from 'bitcoinjs-lib'

import { type Account, type Key, type Secret } from '@/types/models/Account'
import { type Utxo } from '@/types/models/Utxo'
import { getKeyFingerprint } from '@/utils/account'
import { bitcoinjsNetwork } from '@/utils/bitcoin'

const bip32 = BIP32Factory(ecc)

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

type SigningResult = {
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
  validation?: {
    isValid: boolean
    inputs: {
      index: number
      hasPartialSigs: boolean
      partialSigs: { pubkey: string; signature: string }[]
      hasWitnessUtxo: boolean
      hasNonWitnessUtxo: boolean
      hasBip32Derivation: boolean
    }[]
    signatures: { inputIndex: number; pubkey: string; signature: string }[]
    warnings: string[]
    errors: string[]
  }
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

function extractPSBTDerivations(psbtBase64: string) {
  const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
  const derivations: {
    fingerprint: string
    derivationPath: string
    publicKey: string
    inputIndex: number
  }[] = []

  for (const [inputIndex, input] of psbt.data.inputs.entries()) {
    if (input.bip32Derivation) {
      for (const derivation of input.bip32Derivation) {
        const fingerprint = derivation.masterFingerprint.toString('hex')
        const derivationPath = derivation.path
        const publicKey = derivation.pubkey.toString('hex')

        derivations.push({
          derivationPath,
          fingerprint,
          inputIndex,
          publicKey
        })
      }
    }
  }

  return derivations
}

export async function findMatchingAccount(
  psbtBase64: string,
  accounts: Account[]
) {
  let derivations: ReturnType<typeof extractPSBTDerivations> | undefined

  try {
    derivations = extractPSBTDerivations(psbtBase64)
  } catch {
    return null
  }

  if (!derivations || derivations.length === 0) {
    return null
  }

  const psbtFingerprints = [...new Set(derivations.map((d) => d.fingerprint))]

  for (const account of accounts) {
    if (!account.keys || account.keys.length === 0) {
      continue
    }

    const accountFingerprints: string[] = []
    const keyFingerprintMap = new Map<string, number>()

    for (let keyIndex = 0; keyIndex < account.keys.length; keyIndex += 1) {
      const key = account.keys[keyIndex]
      const keyFingerprint = await getKeyFingerprint(key)

      if (!keyFingerprint) {
        continue
      }

      accountFingerprints.push(keyFingerprint)
      keyFingerprintMap.set(keyFingerprint, keyIndex)
    }

    const allFingerprintsMatch = psbtFingerprints.every((psbtFp) =>
      accountFingerprints.includes(psbtFp)
    )

    if (!allFingerprintsMatch) {
      continue
    }

    const firstMatchingDerivation = derivations.find((d) =>
      accountFingerprints.includes(d.fingerprint)
    )

    if (!firstMatchingDerivation) {
      continue
    }
    const matchingKeyIndex = keyFingerprintMap.get(
      firstMatchingDerivation.fingerprint
    )!
    return {
      account,
      cosignerIndex: matchingKeyIndex,
      derivationPath: firstMatchingDerivation.derivationPath,
      fingerprint: firstMatchingDerivation.fingerprint,
      publicKey: firstMatchingDerivation.publicKey
    }
  }

  return null
}

export function signPSBTWithSeed(
  psbtBase64: string,
  seedWords: string,
  scriptType: 'P2WSH' | 'P2SH' | 'P2SH-P2WSH' = 'P2WSH'
): SigningResult {
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

  for (const [inputIndex, input] of psbt.data.inputs.entries()) {
    if (input.bip32Derivation) {
      for (const derivation of input.bip32Derivation) {
        derivations.push({
          fingerprint: derivation.masterFingerprint.toString('hex'),
          inputIndex,
          path: derivation.path,
          pubkey: derivation.pubkey.toString('hex')
        })
      }
    }
  }

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
        const privateKeyBuffer = new Uint8Array(Buffer.from(privateKey, 'hex'))
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
      signedInputs += 1
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
    fingerprint: seedFingerprint,
    inputIndex: matchingDerivations[0].inputIndex,
    inputIndices: matchingDerivations.map((d) => d.inputIndex),
    originalPSBT: psbtBase64,
    path: matchingDerivations[0].path,
    privateKey: '',
    publicKey: matchingDerivations[0].pubkey,
    signature:
      psbt.data.inputs[
        matchingDerivations[0].inputIndex
      ].partialSig?.[0]?.signature?.toString('hex') || '',
    signedInputsCount: signedInputs,
    signedPSBT,
    success: true,
    validation
  }
}

function getSignedPSBTValidationInfo(signedPSBT: string) {
  const psbt = bitcoinjs.Psbt.fromBase64(signedPSBT)
  const validation = {
    errors: [] as string[],
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
    }[],
    isValid: true,
    signatures: [] as {
      inputIndex: number
      pubkey: string
      signature: string
    }[],
    warnings: [] as string[]
  }

  // Check each input for signatures
  for (const [inputIndex, input] of psbt.data.inputs.entries()) {
    const inputInfo = {
      hasBip32Derivation: !!input.bip32Derivation,
      hasNonWitnessUtxo: !!input.nonWitnessUtxo,
      hasPartialSigs: false,
      hasWitnessUtxo: !!input.witnessUtxo,
      index: inputIndex,
      partialSigs: [] as {
        pubkey: string
        signature: string
      }[]
    }

    // Check for partial signatures
    if (input.partialSig && input.partialSig.length > 0) {
      inputInfo.hasPartialSigs = true
      for (const sig of input.partialSig) {
        inputInfo.partialSigs.push({
          pubkey: sig.pubkey.toString('hex'),
          signature: sig.signature.toString('hex')
        })
        validation.signatures.push({
          inputIndex,
          pubkey: sig.pubkey.toString('hex'),
          signature: sig.signature.toString('hex')
        })
      }
    } else {
      validation.warnings.push(`Input ${inputIndex} has no partial signatures`)
    }

    validation.inputs.push(inputInfo)
  }

  return validation
}

export function extractTransactionIdFromPSBT(
  psbtBase64: string
): string | null {
  const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
  try {
    const tx = psbt.extractTransaction()
    return tx.getId()
  } catch {
    const { unsignedTx } = psbt.data.globalMap
    if (unsignedTx) {
      const txBuffer = unsignedTx.toBuffer()
      const hash = bitcoinjs.crypto.hash256(txBuffer)
      return Buffer.from(hash.toReversed()).toString('hex')
    }
  }
  return null
}

export function extractTransactionDataFromPSBTEnhanced(
  psbtBase64: string,
  account: Account
): ExtractedTransactionData | null {
  if (!psbtBase64 || !account) {
    return null
  }

  const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
  const network = bitcoinjsNetwork(account.network)

  const inputs = psbt.data.inputs.map((input, index) => {
    const psbtInput = input as PsbtInput
    const txInput = psbt.txInputs[index]
    const txid = Buffer.from(txInput.hash.toReversed()).toString('hex')
    const vout = txInput.index

    let value = 0
    let script = ''
    let address = ''

    if (psbtInput.witnessUtxo) {
      ;({ value } = psbtInput.witnessUtxo)
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
      address,
      keychain: 'external' as const,
      label: `Input ${index + 1}`,
      script,
      txid,
      value,
      vout
    }
  })

  const outputs = psbt.txOutputs.map((output, index) => {
    const script = output.script.toString('hex')
    const { value } = output
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
      label: `Output ${index + 1}`,
      script,
      value
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
    fee,
    inputs,
    network: (account.network === 'bitcoin' ? 'mainnet' : account.network) as
      | 'mainnet'
      | 'testnet'
      | 'signet',
    outputs
  }
}

// Function to combine multiple base64 PSBTs
export function combinePsbts(psbtBase64s: string[]): string {
  if (psbtBase64s.length === 0) {
    throw new Error('No PSBTs provided to combine.')
  }

  const basePsbt = bitcoinjs.Psbt.fromBase64(psbtBase64s[0])

  for (let i = 1; i < psbtBase64s.length; i += 1) {
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

  for (const input of psbt.txInputs) {
    newPsbt.addInput({
      hash: input.hash,
      index: input.index,
      sequence: input.sequence
    })
  }

  for (const output of psbt.txOutputs) {
    newPsbt.addOutput({
      script: output.script,
      value: output.value
    })
  }

  for (const [index, input] of psbt.data.inputs.entries()) {
    const {
      partialSig: _partialSig,
      finalScriptSig: _finalScriptSig,
      finalScriptWitness: _finalScriptWitness,
      ...nonSignatureData
    } = input
    newPsbt.updateInput(index, nonSignatureData)
  }

  for (const [index, output] of psbt.data.outputs.entries()) {
    newPsbt.updateOutput(index, output)
  }

  return newPsbt.toBase64()
}

export function getMultisigInfoFromPsbt(psbtBase64: string) {
  const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
  if (psbt.data.inputs.length === 0) {
    return null
  }

  const [firstInput] = psbt.data.inputs
  const script = firstInput.witnessScript || firstInput.redeemScript

  if (!script) {
    return null
  }

  const decompiled = bitcoinjs.script.decompile(script)
  if (!decompiled || decompiled.length < 4) {
    return null
  }

  const [mOp] = decompiled
  const nOp = decompiled.at(-2)!

  const m = bitcoinjs.script.number.decode(
    Buffer.isBuffer(mOp) ? mOp : Buffer.from([mOp - 80])
  )
  const n = bitcoinjs.script.number.decode(
    Buffer.isBuffer(nOp) ? nOp : Buffer.from([nOp - 80])
  )

  return { required: m, total: n }
}

export function getCollectedSignerPubkeys(psbtBase64: string) {
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
  const combinedPsbt = bitcoinjs.Psbt.fromBase64(combinedPsbtBase64)

  const individualSignedPsbts: Record<number, string> = {}

  const signerPubkeys = getCollectedSignerPubkeys(combinedPsbtBase64)
  const signerPubkeyArray = Array.from(signerPubkeys)

  for (const [index, pubkey] of signerPubkeyArray.entries()) {
    const individualPsbt = bitcoinjs.Psbt.fromBase64(originalPsbtBase64)

    for (const [inputIndex, input] of combinedPsbt.data.inputs.entries()) {
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
    }

    individualSignedPsbts[index] = individualPsbt.toBase64()
  }

  return individualSignedPsbts
}

export function validatePsbt(
  psbtBase64: string,
  utxos: Utxo[],
  accountKeyFingerprints: string[]
) {
  const errors: string[] = []
  const warnings: string[] = []

  const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)

  // 1. Validate all inputs are valid
  const invalidInputs: number[] = []
  for (const [index, input] of psbt.data.inputs.entries()) {
    if (!input.witnessUtxo && !input.nonWitnessUtxo) {
      invalidInputs.push(index)
    } else if (input.witnessUtxo) {
      if (
        !input.witnessUtxo.script ||
        input.witnessUtxo.value === undefined ||
        input.witnessUtxo.value <= 0
      ) {
        invalidInputs.push(index)
      }
    } else if (input.nonWitnessUtxo) {
      try {
        const prevTx = bitcoinjs.Transaction.fromBuffer(input.nonWitnessUtxo)
        const txInput = psbt.txInputs[index]
        const prevOut = prevTx.outs[txInput.index]
        if (!prevOut || prevOut.value <= 0) {
          invalidInputs.push(index)
        }
      } catch {
        invalidInputs.push(index)
      }
    }
  }

  if (invalidInputs.length > 0) {
    errors.push(
      `Invalid inputs detected at indices: ${invalidInputs.join(', ')}`
    )
  }

  // 2. Check if UTXOs are spendable (exist in wallet)
  const unspendableUtxos: string[] = []
  const utxoMap = new Map<string, Utxo>()
  for (const utxo of utxos) {
    utxoMap.set(`${utxo.txid}:${utxo.vout}`, utxo)
  }

  for (const [index, txInput] of psbt.txInputs.entries()) {
    const txid = Buffer.from(txInput.hash.toReversed()).toString('hex')
    const vout = txInput.index
    const utxoKey = `${txid}:${vout}`

    if (!utxoMap.has(utxoKey)) {
      unspendableUtxos.push(
        `Input ${index + 1} (${txid.substring(0, 8)}...:${vout})`
      )
    }
  }

  if (unspendableUtxos.length > 0) {
    warnings.push(
      `Some UTXOs are not spendable or not found in wallet: ${unspendableUtxos
        .slice(0, 3)
        .join(', ')}${unspendableUtxos.length > 3 ? '...' : ''}`
    )
  }

  // 3. Check if PSBT is associated with this policy/account
  const derivations = extractPSBTDerivations(psbtBase64)
  if (derivations.length === 0) {
    warnings.push(
      'PSBT does not contain BIP32 derivation paths. Cannot verify account association.'
    )
  } else {
    const psbtFingerprints = [...new Set(derivations.map((d) => d.fingerprint))]
    const allFingerprintsMatch = psbtFingerprints.every((psbtFp) =>
      accountKeyFingerprints.includes(psbtFp)
    )

    if (!allFingerprintsMatch) {
      const someFingerprintsMatch = psbtFingerprints.some((psbtFp) =>
        accountKeyFingerprints.includes(psbtFp)
      )

      if (!someFingerprintsMatch) {
        errors.push(
          'PSBT does not match this account. Fingerprints in PSBT do not match account keys.'
        )
      } else {
        warnings.push(
          'PSBT may not be fully associated with this account. Please verify before signing.'
        )
      }
    }
  }

  return { errors, warnings }
}

export function validateNormalizedPsbt(
  signedPsbt: string,
  account: Account,
  cosignerIndex: number,
  decryptedKey?: Key
): boolean | null {
  if (!signedPsbt || signedPsbt.trim().length === 0) {
    return null
  }
  try {
    const psbtToValidate = normalizePsbtToBase64(signedPsbt)
    return account.policyType === 'multisig'
      ? validateSignedPSBTForCosigner(
          psbtToValidate,
          account,
          cosignerIndex,
          decryptedKey
        )
      : validateSignedPSBT(psbtToValidate, account)
  } catch {
    return false
  }
}

export function normalizePsbtToBase64(psbt: string): string {
  if (psbt.toLowerCase().startsWith('70736274ff')) {
    return Buffer.from(psbt, 'hex').toString('base64')
  }
  if (
    !psbt.startsWith('cHNidP') &&
    /^[a-fA-F0-9]+$/.test(psbt) &&
    psbt.length > 100
  ) {
    try {
      return Buffer.from(psbt, 'hex').toString('base64')
    } catch {
      return psbt
    }
  }
  return psbt
}

export function validateSignedPSBT(
  psbtBase64: string,
  account: Account
): boolean {
  let psbt: bitcoinjs.Psbt | undefined
  try {
    psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
  } catch {
    return false
  }

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
}

export function validateSignedPSBTForCosigner(
  psbtBase64: string,
  account: Account,
  cosignerIndex: number,
  decryptedKey?: Key
): boolean {
  if (!validateSignedPSBT(psbtBase64, account)) {
    return false
  }

  if (account.policyType !== 'multisig') {
    return true
  }

  if (!account.keys || !account.keys[cosignerIndex]) {
    return true
  }

  try {
    const selectedAccountKey = account.keys[cosignerIndex]
    const psbt = bitcoinjs.Psbt.fromBase64(psbtBase64)
    const keyToUse = decryptedKey || selectedAccountKey
    return validateCosignerSignature(psbt, keyToUse)
  } catch {
    return false
  }
}

function hasValidStructure(psbt: bitcoinjs.Psbt) {
  return !!(
    psbt.data.inputs &&
    psbt.data.inputs.length > 0 &&
    psbt.data.outputs &&
    psbt.data.outputs.length > 0
  )
}

function validateMultisigPSBT(psbt: bitcoinjs.Psbt) {
  try {
    return psbt.data.inputs.every(validateMultisigInput)
  } catch {
    return false
  }
}

function validateSinglesigPSBT(psbt: bitcoinjs.Psbt) {
  try {
    return psbt.data.inputs.every(validateSinglesigInput)
  } catch {
    return false
  }
}

function validateMultisigInput(
  input: bitcoinjs.Psbt['data']['inputs'][number]
) {
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

function validateSinglesigInput(
  input: bitcoinjs.Psbt['data']['inputs'][number]
) {
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

function validateInputsAndOutputs(psbt: bitcoinjs.Psbt) {
  try {
    const inputsValid = psbt.data.inputs.every(validateInput)
    const outputsValid = psbt.data.outputs.every(validateOutput)
    return inputsValid && outputsValid
  } catch {
    return false
  }
}

function validateInput(
  input: bitcoinjs.Psbt['data']['inputs'][number]
): boolean {
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

function validateOutput(
  output: bitcoinjs.Psbt['data']['outputs'][number]
): boolean {
  return !!output
}

function isValidWitnessUtxo(witnessUtxo: {
  script: Buffer
  value: number
}): boolean {
  return !!(
    witnessUtxo.script &&
    witnessUtxo.value !== undefined &&
    witnessUtxo.value > 0
  )
}

function isValidNonWitnessUtxo(nonWitnessUtxo: Buffer): boolean {
  return !!(nonWitnessUtxo && nonWitnessUtxo.length > 0)
}

function parseWitnessScript(witnessScript: Buffer) {
  const script = bitcoinjs.script.decompile(witnessScript)
  if (!script || script.length < 3) {
    return null
  }

  const [op] = script
  if (!isValidOpCode(op)) {
    return null
  }

  const threshold = (op as number) - 80
  const totalKeys = countPublicKeysInScript(script)

  return { threshold, totalKeys }
}

function isValidOpCode(op: number | Buffer): boolean {
  return typeof op === 'number' && op >= 81 && op <= 96
}

function countPublicKeysInScript(script: (number | Buffer)[]): number {
  return script.filter((item): item is Buffer => Buffer.isBuffer(item)).length
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

function isValidMultisigSignatureCount(
  signatureCount: number,
  totalKeys: number
): boolean {
  return signatureCount > 0 && signatureCount <= totalKeys
}

function countSignatures(
  partialSig: bitcoinjs.Psbt['data']['inputs'][number]['partialSig']
): number {
  if (!partialSig) {
    return 0
  }
  return Array.isArray(partialSig) ? partialSig.length : 1
}

function validateSignatureFormat(
  partialSig: bitcoinjs.Psbt['data']['inputs'][number]['partialSig']
) {
  if (!partialSig) {
    return true
  }

  const sigs = Array.isArray(partialSig) ? partialSig : [partialSig]

  return sigs.every(isValidSignature)
}

function isValidSignature(
  sig: NonNullable<
    bitcoinjs.Psbt['data']['inputs'][number]['partialSig']
  >[number]
) {
  if (!sig.pubkey || !sig.signature) {
    return false
  }

  const sigLength = sig.signature.length
  return sigLength >= 64 && sigLength <= 72
}

function validateCosignerSignature(
  psbt: bitcoinjs.Psbt,
  cosignerKey: Key
): boolean {
  const cosignerPublicKey = extractCosignerPublicKey(psbt, cosignerKey)

  if (!cosignerPublicKey) {
    return false
  }

  const hasSignature = checkSignatureForPublicKey(psbt, cosignerPublicKey)

  return hasSignature
}

function extractCosignerPublicKey(
  psbt: bitcoinjs.Psbt,
  cosignerKey: Key
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
  cosignerKey: Key
): string {
  const cosignerFingerprint = cosignerKey.fingerprint
  if (!cosignerFingerprint) {
    return ''
  }

  return findDerivedPublicKey(psbt, cosignerFingerprint)
}

function extractPublicKeyFromDecryptedKey(
  psbt: bitcoinjs.Psbt,
  cosignerKey: Key
) {
  const innerFingerprint = (cosignerKey.secret as Secret).fingerprint
  if (!innerFingerprint) {
    return ''
  }

  return findDerivedPublicKey(psbt, innerFingerprint)
}

export function findDerivedPublicKey(
  psbt: bitcoinjs.Psbt,
  fingerprint: string
) {
  for (const input of psbt.data.inputs) {
    const publicKey = findPublicKeyInInput(input, fingerprint)
    if (publicKey) {
      return publicKey
    }
  }

  return ''
}

function findPublicKeyInInput(
  input: bitcoinjs.Psbt['data']['inputs'][number],
  fingerprint: string
): string {
  if (!input.bip32Derivation) {
    return ''
  }

  for (const derivation of input.bip32Derivation) {
    const derivationFingerprint = derivation.masterFingerprint.toString('hex')

    if (derivationFingerprint === fingerprint) {
      return derivation.pubkey.toString('hex')
    }
  }

  return ''
}

function checkSignatureForPublicKey(psbt: bitcoinjs.Psbt, publicKey: string) {
  return psbt.data.inputs.some((input) =>
    hasSignatureFromPublicKey(input, publicKey)
  )
}

function hasSignatureFromPublicKey(
  input: bitcoinjs.Psbt['data']['inputs'][number],
  publicKey: string
): boolean {
  if (!input.partialSig || input.partialSig.length === 0) {
    return false
  }

  const signatures = Array.isArray(input.partialSig)
    ? input.partialSig
    : [input.partialSig]

  return signatures.some((sig: { pubkey: Buffer; signature: Buffer }) => {
    if (!sig.pubkey) {
      return false
    }
    const sigPublicKey = sig.pubkey.toString('hex')
    return sigPublicKey === publicKey
  })
}

type SignedPsbtMatch = {
  cosignerIndex: number
  signedPsbtBase64: string
  matchMethod: 'pubkey' | 'validation'
}

export function matchSignedPsbtsToCosigners(
  signedPsbts: Record<number, string>,
  pubkeyToCosignerIndex: Map<string, number>,
  account: Account,
  decryptedKeys: Key[],
  existingSignedPsbts: Map<number, string>
) {
  const matches: SignedPsbtMatch[] = []

  for (const indivBase64 of Object.values(signedPsbts)) {
    const indivPubkeys = getCollectedSignerPubkeys(indivBase64)
    let matched = false
    for (const pubkey of indivPubkeys) {
      const cosignerIndex = pubkeyToCosignerIndex.get(pubkey)
      if (cosignerIndex === undefined) {
        continue
      }

      const existing = existingSignedPsbts.get(cosignerIndex)
      if (existing && existing.trim().length > 0) {
        continue
      }

      matches.push({
        cosignerIndex,
        matchMethod: 'pubkey',
        signedPsbtBase64: indivBase64
      })
      matched = true
      break
    }

    if (matched) {
      continue
    }

    const totalCosigners = account.keys?.length || 0
    for (let cosIdx = 0; cosIdx < totalCosigners; cosIdx += 1) {
      const isValid = validateSignedPSBTForCosigner(
        indivBase64,
        account,
        cosIdx,
        decryptedKeys[cosIdx]
      )
      if (!isValid) {
        continue
      }

      const existing = existingSignedPsbts.get(cosIdx)
      if (existing && existing.trim().length > 0) {
        break
      }

      matches.push({
        cosignerIndex: cosIdx,
        matchMethod: 'validation',
        signedPsbtBase64: indivBase64
      })
      break
    }
  }

  return matches
}
