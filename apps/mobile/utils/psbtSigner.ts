import * as ecc from '@bitcoinerlab/secp256k1'
import BIP32Factory from 'bip32'
import * as bip39 from 'bip39'
import * as bitcoin from 'bitcoinjs-lib'

// Initialize BIP32 with elliptic curve
const bip32 = BIP32Factory(ecc)

// Configure bitcoinjs-lib to use the React Native compatible elliptic curve library
bitcoin.initEccLib(ecc)

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
  validation?: any
  error?: string
}

/**
 * Sign PSBT with seed words
 * @param psbtBase64 - The PSBT in base64 format
 * @param seedWords - Space-separated seed words
 * @param scriptType - Script type ('P2WSH', 'P2SH', 'P2SH-P2WSH')
 * @returns Signing result
 */
function signPSBTWithSeed(
  psbtBase64: string,
  seedWords: string,
  scriptType: 'P2WSH' | 'P2SH' | 'P2SH-P2WSH' = 'P2WSH'
): SigningResult {
  try {
    // Parse PSBT
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64)

    // Validate mnemonic
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

    // We'll derive the key for each input individually since they may have different paths

    // Sign ALL matching inputs - derive the correct key for each input
    let signedInputs = 0
    for (const derivation of matchingDerivations) {
      // Derive the private key using the specific path for this input
      const derivedKey = root.derivePath(derivation.path)
      const privateKey = derivedKey.privateKey
        ? Buffer.from(derivedKey.privateKey).toString('hex')
        : Buffer.alloc(32).toString('hex')
      const publicKey = Buffer.from(derivedKey.publicKey).toString('hex')

      // Verify the derived public key matches the PSBT for this input
      if (publicKey !== derivation.pubkey) {
        // Clear sensitive data from memory
        if (derivedKey.privateKey) {
          derivedKey.privateKey.fill(0)
        }
        continue
      }

      // Create signer object with script type-specific configuration for this input
      const signer = {
        publicKey: Buffer.from(publicKey, 'hex'),
        sign: (hash: Buffer) => {
          const privateKeyBuffer = new Uint8Array(
            Buffer.from(privateKey, 'hex')
          )
          const signature = ecc.sign(new Uint8Array(hash), privateKeyBuffer)
          privateKeyBuffer.fill(0) // Clear immediately after use
          return Buffer.from(signature)
        }
      }

      // Clear private key from memory after creating signer
      if (derivedKey.privateKey) {
        derivedKey.privateKey.fill(0)
      }

      // Check if the input has the required script data for the script type
      const inputData = psbt.data.inputs[derivation.inputIndex]

      switch (scriptType) {
        case 'P2WSH':
          // For P2WSH, we need witness script
          if (!inputData.witnessScript) {
            console.log(
              `❌ signPSBTWithSeed: Input ${derivation.inputIndex} missing witness script`
            )
            continue
          }
          break

        case 'P2SH':
          // For P2SH, we need redeem script
          if (!inputData.redeemScript) {
            console.log(
              `❌ signPSBTWithSeed: Input ${derivation.inputIndex} missing redeem script`
            )
            continue
          }
          break

        case 'P2SH-P2WSH':
          // For P2SH-P2WSH, we need both redeem script and witness script
          if (!inputData.redeemScript) {
            console.log(
              `❌ signPSBTWithSeed: Input ${derivation.inputIndex} missing redeem script`
            )
            continue
          }
          if (!inputData.witnessScript) {
            console.log(
              `❌ signPSBTWithSeed: Input ${derivation.inputIndex} missing witness script`
            )
            continue
          }
          break

        default:
        // For other script types, we don't need additional validation
      }

      // Sign the input
      try {
        psbt.signInput(derivation.inputIndex, signer)
        signedInputs++

        // Check if signature was added
        const input = psbt.data.inputs[derivation.inputIndex]
        if (!input.partialSig || input.partialSig.length === 0) {
          // Signature was not added
        }
      } catch (signError) {
        // Continue with other inputs even if this one fails
        continue
      }
    }

    if (signedInputs === 0) {
      throw new Error('Failed to sign any inputs')
    }

    // Get the signed PSBT
    const signedPSBT = psbt.toBase64()

    // Clear sensitive data from memory
    if (root.privateKey) {
      root.privateKey.fill(0)
    }

    // Validate the signed PSBT
    const validation = validateSignedPSBT(signedPSBT)

    return {
      success: true,
      originalPSBT: psbtBase64,
      signedPSBT,
      inputIndex: matchingDerivations[0].inputIndex, // Return the first input index for compatibility
      inputIndices: matchingDerivations.map((d) => d.inputIndex), // Return all signed input indices
      publicKey: matchingDerivations[0].pubkey, // Return the first derivation's pubkey for compatibility
      privateKey: '', // Don't return private key for security
      fingerprint: seedFingerprint,
      path: matchingDerivations[0].path, // Return the first derivation's path for compatibility
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
function validateSignedPSBT(signedPSBT: string) {
  try {
    const psbt = bitcoin.Psbt.fromBase64(signedPSBT)
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

export { type SigningResult, signPSBTWithSeed, validateSignedPSBT }
