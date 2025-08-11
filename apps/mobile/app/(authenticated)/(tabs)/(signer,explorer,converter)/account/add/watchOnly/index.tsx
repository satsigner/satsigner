import { URDecoder } from '@ngraveio/bc-ur'
import { Descriptor } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import bs58check from 'bs58check'
import * as CBOR from 'cbor-js'
import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { router, Stack } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, Keyboard, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCollapsible from '@/components/SSCollapsible'
import SSModal from '@/components/SSModal'
import SSRadioButton from '@/components/SSRadioButton'
import SSScriptVersionModal from '@/components/SSScriptVersionModal'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import useAccountBuilderFinish from '@/hooks/useAccountBuilderFinish'
import { useNFCReader } from '@/hooks/useNFCReader'
import useSyncAccountWithAddress from '@/hooks/useSyncAccountWithAddress'
import useSyncAccountWithWallet from '@/hooks/useSyncAccountWithWallet'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import { type CreationType } from '@/types/models/Account'
import { decodeBBQRChunks, isBBQRFragment } from '@/utils/bbqr'
import {
  convertKeyFormat,
  getDerivationPathFromScriptVersion
} from '@/utils/bitcoin'
import { decodeMultiPartURToPSBT, decodeURToPSBT } from '@/utils/ur'
import {
  isCombinedDescriptor,
  validateAddress,
  validateCombinedDescriptor,
  validateDescriptor,
  validateDescriptorFormat,
  validateExtendedKey,
  validateFingerprint
} from '@/utils/validation'

const watchOnlyOptions: CreationType[] = [
  'importExtendedPub',
  'importDescriptor',
  'importAddress'
]

export default function WatchOnly() {
  const updateAccount = useAccountsStore((state) => state.updateAccount)
  const [
    name,
    scriptVersion,
    fingerprint,
    setCreationType,
    clearAccount,
    getAccountData,
    setFingerprint,
    setExternalDescriptor,
    setInternalDescriptor,
    setExtendedPublicKey,
    setScriptVersion,
    setKey,
    setNetwork,
    setPolicyType
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.scriptVersion,
      state.fingerprint,
      state.setCreationType,
      state.clearAccount,
      state.getAccountData,
      state.setFingerprint,
      state.setExternalDescriptor,
      state.setInternalDescriptor,
      state.setExtendedPublicKey,
      state.setScriptVersion,
      state.setKey,
      state.setNetwork,
      state.setPolicyType
    ])
  )
  const [network, connectionMode] = useBlockchainStore((state) => [
    state.selectedNetwork,
    state.configs[state.selectedNetwork].config.connectionMode
  ])
  const { accountBuilderFinish } = useAccountBuilderFinish()
  const { syncAccountWithWallet } = useSyncAccountWithWallet()
  const { syncAccountWithAddress } = useSyncAccountWithAddress()
  const { isAvailable, isReading, readNFCTag, cancelNFCScan } = useNFCReader()
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [permission, requestPermission] = useCameraPermissions()

  const [selectedOption, setSelectedOption] =
    useState<CreationType>('importExtendedPub')

  const [modalOptionsVisible, setModalOptionsVisible] = useState(true)
  const [scriptVersionModalVisible, setScriptVersionModalVisible] =
    useState(false)

  const [xpub, setXpub] = useState('')
  const [localFingerprint, setLocalFingerprint] = useState(fingerprint)
  const [externalDescriptor, setLocalExternalDescriptor] = useState('')
  const [internalDescriptor, setLocalInternalDescriptor] = useState('')
  const [address, setAddress] = useState('')

  const [disabled, setDisabled] = useState(true)
  const [validAddress, setValidAddress] = useState(true)
  const [validExternalDescriptor, setValidExternalDescriptor] = useState(true)
  const [validInternalDescriptor, setValidInternalDescriptor] = useState(true)
  const [validXpub, setValidXpub] = useState(true)
  const [validMasterFingerprint, setValidMasterFingerprint] = useState(true)

  const [loadingWallet, setLoadingWallet] = useState(false)

  // Multipart QR scanning state
  const urDecoderRef = useRef<URDecoder>(new URDecoder())
  const [scanProgress, setScanProgress] = useState<{
    type: 'raw' | 'ur' | 'bbqr' | null
    total: number
    scanned: Set<number>
    chunks: Map<number, string>
  }>({
    type: null,
    total: 0,
    scanned: new Set(),
    chunks: new Map()
  })

  const pulseAnim = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (isReading) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: false
          })
        ])
      )

      const scaleAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 0.98,
            duration: 500,
            useNativeDriver: false
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: false
          })
        ])
      )

      pulseAnimation.start()
      scaleAnimation.start()
      return () => {
        pulseAnimation.stop()
        scaleAnimation.stop()
      }
    } else {
      pulseAnim.setValue(0)
      scaleAnim.setValue(1)
    }
  }, [isReading, pulseAnim, scaleAnim])

  // Set policy type to watchonly when component mounts
  useEffect(() => {
    setPolicyType('watchonly')
  }, [setPolicyType])

  const updateDescriptorValidationState = useCallback(() => {
    // Allow import if either external or internal descriptor is valid
    // At least one descriptor must be provided and valid

    const hasValidExternal = externalDescriptor && validExternalDescriptor
    const hasValidInternal = internalDescriptor && validInternalDescriptor
    const hasAnyValidDescriptor = hasValidExternal || hasValidInternal

    if (selectedOption === 'importDescriptor') {
      setDisabled(!hasAnyValidDescriptor)
    }
  }, [
    externalDescriptor,
    internalDescriptor,
    validExternalDescriptor,
    validInternalDescriptor,
    selectedOption
  ])

  // Initialize validation state when selected option changes
  useEffect(() => {
    if (selectedOption === 'importDescriptor') {
      updateDescriptorValidationState()
    }
  }, [
    selectedOption,
    externalDescriptor,
    internalDescriptor,
    validExternalDescriptor,
    validInternalDescriptor,
    updateDescriptorValidationState
  ])

  function updateAddress(address: string) {
    const validAddress = address.includes('\n')
      ? address.split('\n').every(validateAddress)
      : validateAddress(address)
    setValidAddress(!address || validAddress)
    if (selectedOption === 'importAddress') {
      setDisabled(!validAddress)
    }
    setAddress(address)
  }

  function updateMasterFingerprint(fingerprint: string) {
    const validFingerprint = validateFingerprint(fingerprint)
    setValidMasterFingerprint(!fingerprint || validFingerprint)
    if (selectedOption === 'importExtendedPub') {
      setDisabled(!validXpub || !validFingerprint)
    }
    setLocalFingerprint(fingerprint)
    if (validFingerprint) {
      setFingerprint(fingerprint)
      Keyboard.dismiss()
    }
  }

  function updateXpub(xpub: string) {
    const validXpub = validateExtendedKey(xpub, network)
    setValidXpub(!xpub || validXpub)
    if (selectedOption === 'importExtendedPub') {
      setDisabled(!validXpub || !localFingerprint)
    }
    setXpub(xpub)

    // For multisig accounts, use the script version from the store instead of auto-detecting
    // The script type should be determined by the multisig configuration, not the xpub prefix
    if (validXpub && localFingerprint) {
      // Use the script version from the store to determine the correct derivation path
      const derivationPath = getDerivationPathFromScriptVersion(
        scriptVersion,
        network
      )
      const formattedXpub = `[${localFingerprint}/${derivationPath}]${xpub}/0/*`
      setExtendedPublicKey(formattedXpub)
      // Don't change the script version - keep the one from the store
    }
  }

  async function updateExternalDescriptor(
    descriptor: string,
    skipChecksumValidation = false
  ) {
    const descriptorValidation = skipChecksumValidation
      ? await validateDescriptorFormat(descriptor)
      : await validateDescriptor(descriptor)
    const basicValidation =
      descriptorValidation.isValid && !descriptor.match(/[txyz]priv/)

    // Network validation - check if descriptor is compatible with selected network
    let networkValidation: { isValid: boolean; error?: string } = {
      isValid: true
    }
    if (basicValidation && descriptor) {
      try {
        // Try to create descriptor with BDK to check network compatibility
        await new Descriptor().create(descriptor, network as Network)
        networkValidation = { isValid: true }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        if (
          errorMessage.includes('Invalid network') ||
          errorMessage.includes('network')
        ) {
          networkValidation = {
            isValid: false,
            error: 'networkIncompatible'
          }
        } else {
          // For other BDK errors, still consider it valid for now
          networkValidation = { isValid: true }
        }
      }
    }

    const validExternalDescriptor = basicValidation && networkValidation.isValid

    setValidExternalDescriptor(!descriptor || validExternalDescriptor)
    setLocalExternalDescriptor(descriptor)
    if (validExternalDescriptor) {
      setExternalDescriptor(descriptor)
    }

    // Update disabled state based on both external and internal descriptors
    // updateDescriptorValidationState()
  }

  async function updateInternalDescriptor(
    descriptor: string,
    skipChecksumValidation = false
  ) {
    const descriptorValidation = skipChecksumValidation
      ? await validateDescriptorFormat(descriptor)
      : await validateDescriptor(descriptor)
    const basicValidation = descriptorValidation.isValid

    // Network validation - check if descriptor is compatible with selected network
    let networkValidation: { isValid: boolean; error?: string } = {
      isValid: true
    }
    if (basicValidation && descriptor) {
      try {
        // Try to create descriptor with BDK to check network compatibility
        await new Descriptor().create(descriptor, network as Network)
        networkValidation = { isValid: true }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        if (
          errorMessage.includes('Invalid network') ||
          errorMessage.includes('network')
        ) {
          networkValidation = {
            isValid: false,
            error: 'networkIncompatible'
          }
        } else {
          // For other BDK errors, still consider it valid for now
          networkValidation = { isValid: true }
        }
      }
    }

    const validInternalDescriptor = basicValidation && networkValidation.isValid

    setValidInternalDescriptor(!descriptor || validInternalDescriptor)
    setLocalInternalDescriptor(descriptor)
    if (validInternalDescriptor) {
      setInternalDescriptor(descriptor)
    }

    // Update disabled state based on both external and internal descriptors
    // updateDescriptorValidationState()
  }

  function convertVpubToTpub(vpub: string): string {
    // If it's not a vpub, return as is
    if (!vpub.startsWith('vpub')) return vpub

    // Use the network-aware conversion utility
    return convertKeyFormat(vpub, 'tpub', network)
  }

  // Helper functions for QR code detection and parsing
  const detectQRType = (data: string) => {
    // Check for RAW format (pXofY header)
    if (/^p\d+of\d+\s/.test(data)) {
      const match = data.match(/^p(\d+)of(\d+)\s/)
      if (match) {
        return {
          type: 'raw' as const,
          current: parseInt(match[1], 10) - 1, // Convert to 0-based index
          total: parseInt(match[2], 10),
          content: data.substring(match[0].length)
        }
      }
    }

    // Check for BBQR format
    if (isBBQRFragment(data)) {
      const total = parseInt(data.slice(4, 6), 36)
      const current = parseInt(data.slice(6, 8), 36)
      return {
        type: 'bbqr' as const,
        current,
        total,
        content: data
      }
    }

    // Check for UR format (crypto-account, crypto-psbt, etc.)
    if (data.toLowerCase().startsWith('ur:crypto-')) {
      // UR format: ur:crypto-*/[sequence]/[data] for multi-part
      // or ur:crypto-*/[data] for single part
      const urMatch = data.match(/^ur:crypto-[^/]+\/(?:(\d+)-(\d+)\/)?(.+)$/i)
      if (urMatch) {
        const [, currentStr, totalStr] = urMatch

        if (currentStr && totalStr) {
          // Multi-part UR
          const current = parseInt(currentStr, 10) - 1 // Convert to 0-based index
          const total = parseInt(totalStr, 10)
          return {
            type: 'ur' as const,
            current,
            total,
            content: data
          }
        } else {
          // Single-part UR
          return {
            type: 'ur' as const,
            current: 0,
            total: 1,
            content: data
          }
        }
      }
    }

    // Single QR code (no multi-part format detected)
    return {
      type: 'single' as const,
      current: 0,
      total: 1,
      content: data
    }
  }

  function resetScanProgress() {
    setScanProgress({
      type: null,
      total: 0,
      scanned: new Set(),
      chunks: new Map()
    })
    // Create a new UR decoder instance
    urDecoderRef.current = new URDecoder()
  }

  function decodeURCryptoAccount(urData: Uint8Array): any {
    try {
      // First, try to decode the CBOR structure properly
      try {
        // Use the same pattern as in nostr.ts for CBOR decoding
        const bufferSlice = urData.buffer.slice(
          urData.byteOffset,
          urData.byteOffset + urData.byteLength
        )
        const decodedData = CBOR.decode(bufferSlice as unknown as Uint8Array)

        // Try to process the CBOR data as crypto-account format
        const cryptoAccountResult = processCryptoAccountCBOR(decodedData)
        if (cryptoAccountResult) {
          return cryptoAccountResult
        }

        // Try to process as crypto-output format
        const cryptoOutputResult = processCryptoOutputCBOR(decodedData)
        if (cryptoOutputResult) {
          return cryptoOutputResult
        }

        // If not crypto-output format, try crypto-account format
        if (decodedData && typeof decodedData === 'object') {
          // Look for the expected crypto-account structure
          // The CBOR should contain a map with keys for fingerprint, derivation path, and xpub
          let fingerprint = null
          let derivationPath = null
          let xpub = null

          // Check for common field names
          if (decodedData.fingerprint || decodedData.masterFingerprint) {
            fingerprint = (
              decodedData.fingerprint || decodedData.masterFingerprint
            )
              .toString(16)
              .padStart(8, '0')
          }

          if (decodedData.derivationPath || decodedData.path) {
            derivationPath = decodedData.derivationPath || decodedData.path
          }

          if (
            decodedData.xpub ||
            decodedData.extendedPublicKey ||
            decodedData.publicKey
          ) {
            xpub =
              decodedData.xpub ||
              decodedData.extendedPublicKey ||
              decodedData.publicKey
          }

          // If we found all components, construct the expected format
          if (fingerprint && derivationPath && xpub) {
            const formattedXpub = `[${fingerprint}${derivationPath}]${xpub}`
            return {
              type: 'crypto-account',
              xpub: formattedXpub,
              fingerprint,
              derivationPath,
              name: decodedData.name || decodedData.label || 'Imported Account',
              scriptType: getScriptTypeFromXpub(xpub),
              network: getNetworkFromXpub(xpub)
            }
          }

          // If we only found xpub, try to extract fingerprint and path from the CBOR structure
          if (xpub) {
            // Look for fingerprint in the CBOR data (might be stored as bytes)
            for (const [, value] of Object.entries(decodedData)) {
              // Check if this is a fingerprint (4 bytes = 8 hex chars)
              if (
                typeof value === 'number' &&
                value > 0 &&
                value < 0x100000000
              ) {
                const hexFingerprint = value.toString(16).padStart(8, '0')
                fingerprint = hexFingerprint
              }

              // Check if this is a derivation path
              if (typeof value === 'string' && value.includes("'")) {
                derivationPath = value
              }
            }

            // If we found fingerprint and path, construct the format
            if (fingerprint && derivationPath) {
              const formattedXpub = `[${fingerprint}${derivationPath}]${xpub}`
              return {
                type: 'crypto-account',
                xpub: formattedXpub,
                fingerprint,
                derivationPath,
                name: 'Imported Account',
                scriptType: getScriptTypeFromXpub(xpub),
                network: getNetworkFromXpub(xpub)
              }
            }

            // If we only have xpub, return it as-is
            return {
              type: 'crypto-account',
              xpub,
              name: 'Imported Account',
              scriptType: getScriptTypeFromXpub(xpub),
              network: getNetworkFromXpub(xpub)
            }
          }
        }
      } catch {
        // CBOR decode failed, continue with other methods
      }

      // Try to parse as JSON first (some UR implementations use JSON)
      try {
        const cborString = Buffer.from(urData).toString('utf8')
        const jsonData = JSON.parse(cborString)

        // Look for common fields in crypto account data
        if (jsonData.xpub || jsonData.extendedPublicKey || jsonData.publicKey) {
          const xpub =
            jsonData.xpub || jsonData.extendedPublicKey || jsonData.publicKey
          return {
            type: 'crypto-account',
            xpub,
            name: jsonData.name || jsonData.label || 'Imported Account',
            scriptType: jsonData.scriptType || jsonData.type || 'P2WPKH',
            network: jsonData.network || 'mainnet'
          }
        }
      } catch {
        // Not JSON, continue with other methods
      }

      // If not JSON, try to extract xpub from the CBOR data
      // Look for common xpub patterns in the hex data
      const hexData = Buffer.from(urData).toString('hex')

      // Common xpub prefixes to look for
      const xpubPatterns = [
        /(xpub[a-zA-Z0-9]{107})/, // Mainnet xpub
        /(tpub[a-zA-Z0-9]{107})/, // Testnet tpub
        /(ypub[a-zA-Z0-9]{107})/, // Mainnet ypub (P2SH-P2WPKH)
        /(zpub[a-zA-Z0-9]{107})/, // Mainnet zpub (P2WPKH)
        /(vpub[a-zA-Z0-9]{107})/, // Testnet vpub (P2WPKH)
        /(upub[a-zA-Z0-9]{107})/ // Testnet upub (P2SH-P2WPKH)
      ]

      for (const pattern of xpubPatterns) {
        const match = hexData.match(pattern)
        if (match) {
          const xpub = match[1]
          return {
            type: 'crypto-account',
            xpub,
            name: 'Imported Account',
            scriptType: getScriptTypeFromXpub(xpub),
            network: getNetworkFromXpub(xpub)
          }
        }
      }

      // Try to decode the CBOR structure manually by analyzing the hex
      // Look for byte strings in the CBOR data that might contain xpub
      // CBOR byte strings start with 0x58 (88) followed by length
      const byteStringPattern = /58([0-9a-f]{2})([0-9a-f]+)/g
      let byteStringMatch

      while ((byteStringMatch = byteStringPattern.exec(hexData)) !== null) {
        const data = byteStringMatch[2]

        // Try to decode this byte string as base58
        try {
          const byteStringBytes = Buffer.from(data, 'hex')
          const base58String = byteStringBytes.toString('utf8')

          // Check if it's a valid xpub
          if (base58String.match(/^[txyzuv]pub[a-zA-Z0-9]{107}$/)) {
            return {
              type: 'crypto-account',
              xpub: base58String,
              name: 'Imported Account',
              scriptType: getScriptTypeFromXpub(base58String),
              network: getNetworkFromXpub(base58String)
            }
          }
        } catch {
          // Continue to next byte string
        }
      }

      // Try to decode the CBOR structure more systematically
      // Convert hex to string and look for base58 patterns
      const binaryString = Buffer.from(urData).toString('binary')

      // Look for base58 patterns in the binary data
      const base58Pattern = /[1-9A-HJ-NP-Za-km-z]{111}/g
      const base58Matches = binaryString.match(base58Pattern)

      if (base58Matches) {
        for (const match of base58Matches) {
          // Check if it's a valid xpub format
          if (match.match(/^[txyzuv]pub[a-zA-Z0-9]{107}$/)) {
            return {
              type: 'crypto-account',
              xpub: match,
              name: 'Imported Account',
              scriptType: getScriptTypeFromXpub(match),
              network: getNetworkFromXpub(match)
            }
          }
        }
      }

      // Try to extract from the CBOR structure by looking at specific byte patterns
      // Convert bytes to string and search for xpub patterns
      const rawBytes = Array.from(urData)
      const byteString = String.fromCharCode(...rawBytes)

      // Search for xpub patterns in the byte string
      for (const pattern of xpubPatterns) {
        const match = byteString.match(pattern)
        if (match) {
          const xpub = match[1]
          return {
            type: 'crypto-account',
            xpub,
            name: 'Imported Account',
            scriptType: getScriptTypeFromXpub(xpub),
            network: getNetworkFromXpub(xpub)
          }
        }
      }

      // If no xpub found, return the raw data for debugging
      return {
        type: 'crypto-account',
        rawData: hexData,
        binaryString: binaryString.slice(0, 100), // First 100 chars for debugging
        error: 'No xpub found in data'
      }
    } catch (error) {
      throw new Error(
        `Failed to decode crypto account: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  function getScriptTypeFromXpub(xpub: string): string {
    // For testnet, tpub can be used for different script types
    // The script type should be determined by the derivation path, not just the prefix
    // For now, return a default that matches the most common use case
    if (xpub.startsWith('xpub')) return 'P2PKH'
    if (xpub.startsWith('ypub') || xpub.startsWith('upub')) return 'P2SH-P2WPKH'
    if (xpub.startsWith('zpub') || xpub.startsWith('vpub')) return 'P2WPKH'
    // For tpub, we can't determine the script type from the prefix alone
    // Return P2WPKH as default since it's the most common for modern wallets
    return 'P2WPKH'
  }

  function getNetworkFromXpub(xpub: string): string {
    if (
      xpub.startsWith('xpub') ||
      xpub.startsWith('ypub') ||
      xpub.startsWith('zpub')
    )
      return 'mainnet'
    if (
      xpub.startsWith('tpub') ||
      xpub.startsWith('upub') ||
      xpub.startsWith('vpub')
    )
      return 'testnet'
    return 'mainnet' // Default
  }

  // Helper function to process crypto-output CBOR structure
  function processCryptoOutputCBOR(result: any) {
    // Crypto-output typically contains script data and amount
    // Look for common crypto-output fields
    if (result && typeof result === 'object') {
      // Check for script data (usually in a specific field)
      let scriptData = null
      let amount = null
      let chainCode = null
      let fingerprint = null
      let derivationPath = null

      // Look for script in various possible locations
      if (result.script || result.scriptPubKey) {
        scriptData = result.script || result.scriptPubKey
      } else if (result['1']) {
        // Script might be in field 1
        scriptData = result['1']
      } else if (result['3']) {
        // Script might be in field 3 (based on the actual CBOR structure)
        scriptData = result['3']
      }

      // Look for chain code (field 4)
      if (result['4']) {
        chainCode = result['4']
      }

      // Look for fingerprint (field 2 or field 6.2)
      if (result['2'] && typeof result['2'] === 'number') {
        fingerprint = result['2'].toString(16).padStart(8, '0')
      } else if (
        result['6'] &&
        result['6']['2'] &&
        typeof result['6']['2'] === 'number'
      ) {
        fingerprint = result['6']['2'].toString(16).padStart(8, '0')
      }

      // Look for derivation path (field 6)
      if (result['6'] && result['6']['1']) {
        const pathComponents = result['6']['1']
        // Convert components to path string (e.g., [84, true, 1, true, 0, true] -> "84'/1'/0'")
        const pathParts = []
        for (let i = 0; i < pathComponents.length; i += 2) {
          if (pathComponents[i] !== undefined) {
            const component = pathComponents[i]
            const hardened = pathComponents[i + 1] === true
            pathParts.push(component.toString() + (hardened ? "'" : ''))
          }
        }
        derivationPath = pathParts.join('/')
      }

      // Look for amount
      if (result.amount || result.value) {
        amount = result.amount || result.value
      } else if (result['2'] && typeof result['2'] === 'boolean') {
        // Amount might be in field 2 (if it's not a fingerprint)
        amount = result['2']
      }

      if (scriptData) {
        // Convert script data to hex if it's a Uint8Array
        let scriptHex = scriptData
        if (scriptData instanceof Uint8Array || Array.isArray(scriptData)) {
          scriptHex = Buffer.from(scriptData).toString('hex')
        }

        // Try to construct extended public key if we have all components
        if (scriptData && chainCode && fingerprint && derivationPath) {
          try {
            // Construct xpub from public key + chain code
            // xpub format: [version(4)][depth(1)][fingerprint(4)][child(4)][chaincode(32)][key(33)]

            // For testnet, use tpub version: 0x043587cf
            const version = new Uint8Array([0x04, 0x35, 0x87, 0xcf]) // tpub version
            const depth = new Uint8Array([0x00]) // depth 0 (master)

            // Convert fingerprint to bytes
            const fingerprintBytes = new Uint8Array(4)
            const fingerprintValue = parseInt(fingerprint, 16)
            fingerprintBytes[0] = (fingerprintValue >> 24) & 0xff
            fingerprintBytes[1] = (fingerprintValue >> 16) & 0xff
            fingerprintBytes[2] = (fingerprintValue >> 8) & 0xff
            fingerprintBytes[3] = fingerprintValue & 0xff

            const childNumber = new Uint8Array([0x00, 0x00, 0x00, 0x00]) // child number

            // Convert chain code to Uint8Array
            const chainCodeBytes =
              chainCode instanceof Uint8Array
                ? chainCode
                : new Uint8Array(chainCode)

            // Convert script data to Uint8Array
            const scriptBytes =
              scriptData instanceof Uint8Array
                ? scriptData
                : new Uint8Array(scriptData)

            // Construct full xpub: version + depth + fingerprint + child + chaincode + key
            const fullXpubBytes = new Uint8Array([
              ...version,
              ...depth,
              ...fingerprintBytes,
              ...childNumber,
              ...chainCodeBytes,
              ...scriptBytes
            ])

            // Encode as base58check
            const fullXpub = bs58check.encode(fullXpubBytes)

            // Check if it's a valid xpub format
            if (fullXpub.match(/^tpub[a-zA-Z0-9]{107}$/)) {
              const formattedXpub = `[${fingerprint}/${derivationPath}]${fullXpub}`

              return {
                type: 'crypto-account',
                xpub: formattedXpub,
                fingerprint,
                derivationPath,
                name: 'Imported Account',
                scriptType: 'P2WPKH', // BIP84
                network: 'testnet'
              }
            }
          } catch (_error) {
            return null
          }
        }

        // Fallback to raw script format
        return {
          type: 'crypto-output',
          script: scriptHex,
          amount
        }
      } else {
        return null
      }
    }

    return null
  }

  // Helper function to process crypto-account CBOR structure
  // Based on the decoded structure: {"1": 1623639873, "2": [{"3": [Uint8Array], "4": [Uint8Array], "6": [Object], "8": 727047217}]}
  function processCryptoAccountCBOR(result: any) {
    // Handle crypto-account specific structure
    if (result && typeof result === 'object' && result['1'] && result['2']) {
      // Extract components from the tagged structure
      const fingerprint = result['1'] // This appears to be the fingerprint
      const accountData = result['2'][0] // The account data array

      if (accountData && typeof accountData === 'object') {
        // Look for xpub in the account data
        let xpub = null
        let derivationPath = null
        let xpubBytes: Uint8Array | null = null

        // Check for xpub in various possible locations
        if (
          accountData['3'] &&
          (Array.isArray(accountData['3']) ||
            accountData['3'] instanceof Uint8Array)
        ) {
          // Try to decode as xpub
          try {
            xpubBytes =
              accountData['3'] instanceof Uint8Array
                ? accountData['3']
                : new Uint8Array(accountData['3'])

            // The xpub is stored as raw bytes, we need to encode it as base58check
            // First, let's check if this looks like a compressed public key (33 bytes starting with 02 or 03)
            if (
              xpubBytes.length === 33 &&
              (xpubBytes[0] === 0x02 || xpubBytes[0] === 0x03)
            ) {
              // This appears to be a compressed public key, not a full xpub
              // We need to construct the xpub from the public key
              // For now, let's try to encode it as base58check and see if it's recognizable
              try {
                const base58String = bs58check.encode(xpubBytes)

                // Check if this looks like a valid public key
                if (base58String.length === 44) {
                  // Compressed public key length
                  // We need more information to construct the full xpub
                  // For now, let's try to use this as a starting point
                  xpub = base58String
                }
              } catch (_error) {
                // Failed to encode as base58check
              }
            } else {
              // Try to decode as base58check (might be an xpub)
              try {
                const base58String = bs58check.encode(xpubBytes)

                // Check if it's a valid xpub format
                if (base58String.match(/^[txyzuv]pub[a-zA-Z0-9]{107}$/)) {
                  xpub = base58String
                }
              } catch (_error) {
                // Failed to encode as base58check

                // Try UTF8 as fallback
                const xpubString = Buffer.from(xpubBytes).toString('utf8')

                if (xpubString.match(/^[txyzuv]pub[a-zA-Z0-9]{107}$/)) {
                  xpub = xpubString
                }
              }
            }
          } catch (_error) {
            // Error processing tag 3 data
          }
        }

        // Check for chain code in tag 4 (needed to construct xpub from public key)
        if (
          accountData['4'] &&
          (Array.isArray(accountData['4']) ||
            accountData['4'] instanceof Uint8Array)
        ) {
          const chainCodeBytes =
            accountData['4'] instanceof Uint8Array
              ? accountData['4']
              : new Uint8Array(accountData['4'])

          // If we have both public key (tag 3) and chain code (tag 4), we can construct the xpub
          if (xpubBytes && chainCodeBytes.length === 32) {
            // Construct the xpub from public key + chain code
            // xpub format: [version(4)][depth(1)][fingerprint(4)][child(4)][chaincode(32)][key(33)]
            try {
              // We need to construct the full xpub structure
              // For testnet, use tpub version: 0x043587cf
              const version = new Uint8Array([0x04, 0x35, 0x87, 0xcf]) // tpub version
              const depth = new Uint8Array([0x00]) // depth 0 (master)

              // Use the actual fingerprint from the CBOR data
              const fingerprintBytes = new Uint8Array(4)
              const fingerprintValue = fingerprint
              fingerprintBytes[0] = (fingerprintValue >> 24) & 0xff
              fingerprintBytes[1] = (fingerprintValue >> 16) & 0xff
              fingerprintBytes[2] = (fingerprintValue >> 8) & 0xff
              fingerprintBytes[3] = fingerprintValue & 0xff

              const childNumber = new Uint8Array([0x00, 0x00, 0x00, 0x00]) // child number

              // Construct full xpub: version + depth + fingerprint + child + chaincode + key
              const fullXpubBytes = new Uint8Array([
                ...version,
                ...depth,
                ...fingerprintBytes,
                ...childNumber,
                ...chainCodeBytes,
                ...xpubBytes
              ])

              // Encode as base58check
              const fullXpub = bs58check.encode(fullXpubBytes)

              // Check if it's a valid xpub format
              if (fullXpub.match(/^tpub[a-zA-Z0-9]{107}$/)) {
                xpub = fullXpub
              }
            } catch (_error) {
              // Failed to construct xpub
            }
          }
        }

        // Check for derivation path in tag 6
        if (accountData['6'] && typeof accountData['6'] === 'object') {
          // Try to extract derivation path from the object
          const pathObj = accountData['6']

          // Look for derivation path in various possible locations
          if (pathObj.path || pathObj.derivationPath) {
            derivationPath = pathObj.path || pathObj.derivationPath
          } else if (pathObj.components && Array.isArray(pathObj.components)) {
            // Derivation path might be stored as components array
            // Convert components to path string (e.g., [84, 0, 0] -> "84'/0'/0'")
            const pathComponents = pathObj.components.map((comp: any) => {
              if (typeof comp === 'number') {
                return comp.toString() + "'"
              }
              return comp.toString()
            })
            derivationPath = pathComponents.join('/')
          } else if (pathObj['1'] && Array.isArray(pathObj['1'])) {
            // Derivation path components in tag 1
            const pathComponents = pathObj['1']
              .map((comp: any, index: number) => {
                if (typeof comp === 'number') {
                  return comp.toString() + "'"
                } else if (comp === true) {
                  // Hardened derivation
                  return pathObj['1'][index - 1]?.toString() + "'" || "0'"
                }
                return comp.toString()
              })
              .filter((comp: string) => comp !== "undefined'")
            derivationPath = pathComponents.join('/')
          }
        }

        // If we found xpub, construct the result
        if (xpub) {
          const hexFingerprint = fingerprint.toString(16).padStart(8, '0')
          const formattedXpub = derivationPath
            ? `[${hexFingerprint}/${derivationPath}]${xpub}`
            : xpub

          return {
            type: 'crypto-account',
            xpub: formattedXpub,
            fingerprint: hexFingerprint,
            derivationPath,
            name: 'Imported Account',
            scriptType: getScriptTypeFromXpub(xpub),
            network: getNetworkFromXpub(xpub)
          }
        }
      }
    }

    return null
  }

  const assembleMultiPartQR = (
    type: 'raw' | 'ur' | 'bbqr',
    chunks: Map<number, string>
  ): string | null => {
    try {
      switch (type) {
        case 'raw': {
          // Assemble RAW format chunks
          const sortedChunks = Array.from(chunks.entries())
            .sort(([a], [b]) => a - b)
            .map(([, content]) => content)
          const assembled = sortedChunks.join('')

          // Convert base64 to hex for RAW format
          try {
            const hexResult = Buffer.from(assembled, 'base64').toString('hex')
            return hexResult
          } catch (_error) {
            return assembled
          }
        }

        case 'bbqr': {
          // Assemble BBQR format chunks
          const sortedChunks = Array.from(chunks.entries())
            .sort(([a], [b]) => a - b)
            .map(([, content]) => content)

          const decoded = decodeBBQRChunks(sortedChunks)

          if (decoded) {
            // Convert binary data to hex for consistency
            const hexResult = Buffer.from(decoded).toString('hex')
            return hexResult
          }

          return null
        }

        case 'ur': {
          // UR format assembly using proper UR decoder
          const sortedChunks = Array.from(chunks.entries())
            .sort(([a], [b]) => a - b)
            .map(([, content]) => content)

          if (sortedChunks.length === 1) {
            // Single UR chunk - try to decode as crypto-account
            try {
              const success = urDecoderRef.current.receivePart(sortedChunks[0])
              if (success && urDecoderRef.current.isComplete()) {
                const urResult = urDecoderRef.current.resultUR()
                if (urResult && urResult.cbor) {
                  const decodedAccount = decodeURCryptoAccount(
                    new Uint8Array(urResult.cbor)
                  )
                  return JSON.stringify(decodedAccount)
                }
              }
            } catch (_error) {
              // Fall back to PSBT decoding if crypto-account fails
              try {
                const result = decodeURToPSBT(sortedChunks[0])
                return result
              } catch (_psbtError) {
                return null
              }
            }
          } else {
            // Multi-part UR
            try {
              // Try crypto-account decoding for multi-part first
              const decoder = new URDecoder()
              for (const chunk of sortedChunks) {
                decoder.receivePart(chunk)
              }

              if (decoder.isComplete()) {
                const urResult = decoder.resultUR()
                if (urResult && urResult.cbor) {
                  const decodedAccount = decodeURCryptoAccount(
                    new Uint8Array(urResult.cbor)
                  )
                  return JSON.stringify(decodedAccount)
                }
              }
            } catch {
              // Fall back to PSBT decoding
              try {
                const result = decodeMultiPartURToPSBT(sortedChunks)
                return result
              } catch {
                return null
              }
            }
          }

          return null
        }

        default:
          return null
      }
    } catch (error) {
      toast.error(String(error))
      return null
    }
  }

  async function confirmAccountCreation() {
    setLoadingWallet(true)

    try {
      // Set the creation type first
      setCreationType(selectedOption)

      if (selectedOption === 'importExtendedPub') {
        if (!xpub || !localFingerprint || !scriptVersion) {
          toast.error(t('watchonly.error.missingFields'))
          return
        }
        setExtendedPublicKey(xpub)
        setFingerprint(localFingerprint)
        setScriptVersion(scriptVersion)
      } else if (selectedOption === 'importAddress') {
        const addresses = address.split('\n')
        for (let index = 0; index < addresses.length; index += 1) {
          const address = addresses[index]
          setExternalDescriptor(`addr(${address})`)
        }
      } else if (selectedOption === 'importDescriptor') {
        // Descriptor data should already be set via the input fields
      }

      setNetwork(network)
      setKey(0)

      const account = getAccountData()

      const data = await accountBuilderFinish(account)
      if (!data) {
        toast.error(t('watchonly.error.creationFailed'))
        return
      }

      // Save the account and redirect immediately
      updateAccount(data.accountWithEncryptedSecret)
      toast.success(t('watchonly.success.accountCreated'))
      router.replace('/accountList')

      // Start sync in background if auto mode is enabled
      if (connectionMode === 'auto') {
        // Use setTimeout to ensure this runs after the current execution context
        setTimeout(() => {
          // Wrap the entire async operation in a try-catch
          const backgroundSync = async () => {
            try {
              const updatedAccount =
                selectedOption !== 'importAddress'
                  ? await syncAccountWithWallet(
                      data.accountWithEncryptedSecret,
                      data.wallet!
                    )
                  : await syncAccountWithAddress(
                      data.accountWithEncryptedSecret
                    )
              updateAccount(updatedAccount)
            } catch {
              // Sync failed in background, but user is already on account page
            }
          }

          // Execute the background sync and catch any unhandled rejections
          backgroundSync().catch(() => {
            return null
          })
        }, 100)
      }
    } catch (error) {
      const errorMessage = (error as Error).message
      if (errorMessage) {
        toast.error(errorMessage)
      } else {
        toast.error(t('watchonly.error.creationFailed'))
      }
    } finally {
      clearAccount()
      setLoadingWallet(false)
    }
  }

  async function pasteFromClipboard() {
    const text = await Clipboard.getStringAsync()
    if (!text) return

    if (selectedOption === 'importDescriptor') {
      let externalDescriptor = text
      let internalDescriptor = ''

      // Try to parse as JSON first
      try {
        const jsonData = JSON.parse(text)

        if (jsonData.descriptor) {
          externalDescriptor = jsonData.descriptor

          // Derive internal descriptor from external descriptor
          // Replace /0/* with /1/* for internal chain and remove checksum
          const descriptorWithoutChecksum = externalDescriptor.replace(
            /#[a-z0-9]+$/,
            ''
          )
          internalDescriptor = descriptorWithoutChecksum.replace(
            /\/0\/\*/g,
            '/1/*'
          )
        }
      } catch (_jsonError) {
        // Handle legacy formats
        if (text.includes('\n')) {
          const lines = text.split('\n')
          externalDescriptor = lines[0]
          internalDescriptor = lines[1]
        }
      }

      // Check if the descriptor is combined (contains <0;1> or <0,1>)
      if (isCombinedDescriptor(text)) {
        // Validate the combined descriptor and get separated descriptors
        const combinedValidation = await validateCombinedDescriptor(
          text,
          scriptVersion as string
        )

        if (combinedValidation.isValid) {
          // Set both descriptors and mark them as valid
          setLocalExternalDescriptor(combinedValidation.externalDescriptor)
          setLocalInternalDescriptor(combinedValidation.internalDescriptor)
          setValidExternalDescriptor(true)
          setValidInternalDescriptor(true)

          // Store the descriptors in the store
          setExternalDescriptor(combinedValidation.externalDescriptor)
          setInternalDescriptor(combinedValidation.internalDescriptor)
        } else {
          // Set the separated descriptors but mark them as invalid
          setLocalExternalDescriptor(combinedValidation.externalDescriptor)
          setLocalInternalDescriptor(combinedValidation.internalDescriptor)
          setValidExternalDescriptor(false)
          setValidInternalDescriptor(false)
        }
      } else {
        // Handle non-combined descriptors with existing logic
        if (externalDescriptor) updateExternalDescriptor(externalDescriptor)
        if (internalDescriptor) updateInternalDescriptor(internalDescriptor)
      }
    }

    if (selectedOption === 'importExtendedPub') {
      updateXpub(text)
    }

    if (selectedOption === 'importAddress') {
      updateAddress(text)
    }
  }

  async function handleNFCRead() {
    if (isReading) {
      await cancelNFCScan()
      return
    }

    try {
      const nfcData = await readNFCTag()

      if (!nfcData) {
        toast.error(t('watchonly.read.nfcErrorNoData'))
        return
      }

      if (!nfcData.text) {
        toast.error(t('watchonly.read.nfcErrorNoData'))
        return
      }

      const text = nfcData.text
        .trim()
        .replace(/[^\S\n]+/g, '') // Remove all whitespace except newlines
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces and other invisible characters
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '') // Remove control characters except \n
        .normalize('NFKC') // Normalize unicode characters
        .replace(/^en/, '')

      if (selectedOption === 'importDescriptor') {
        let externalDescriptor = text
        let internalDescriptor = ''
        if (text.includes('\n')) {
          const lines = text.split('\n')
          externalDescriptor = lines[0]
          internalDescriptor = lines[1]
        }

        // Check if the descriptor is combined (contains <0;1> or <0,1>)
        if (isCombinedDescriptor(text)) {
          // Validate the combined descriptor and get separated descriptors
          const combinedValidation = await validateCombinedDescriptor(
            text,
            scriptVersion as string
          )

          if (combinedValidation.isValid) {
            // Set both descriptors and mark them as valid
            setLocalExternalDescriptor(combinedValidation.externalDescriptor)
            setLocalInternalDescriptor(combinedValidation.internalDescriptor)
            setValidExternalDescriptor(true)
            setValidInternalDescriptor(true)

            // Store the descriptors in the store
            setExternalDescriptor(combinedValidation.externalDescriptor)
            setInternalDescriptor(combinedValidation.internalDescriptor)
          } else {
            // Set the separated descriptors but mark them as invalid
            setLocalExternalDescriptor(combinedValidation.externalDescriptor)
            setLocalInternalDescriptor(combinedValidation.internalDescriptor)
            setValidExternalDescriptor(false)
            setValidInternalDescriptor(false)
          }
        } else {
          // Handle non-combined descriptors with existing logic
          if (externalDescriptor) updateExternalDescriptor(externalDescriptor)
          if (internalDescriptor) updateInternalDescriptor(internalDescriptor)
        }
      }

      if (selectedOption === 'importExtendedPub') {
        updateXpub(text)
      }

      if (selectedOption === 'importAddress') {
        updateAddress(text)
      }
    } catch (error) {
      const errorMessage = (error as Error).message
      if (errorMessage) {
        toast.error(errorMessage)
      }
    }
  }

  async function handleQRCodeScanned(data: string | undefined) {
    if (!data) {
      toast.error(t('watchonly.read.qrError'))
      return
    }

    // Detect QR code type and format
    const qrInfo = detectQRType(data)

    // Handle single QR codes (complete data in one scan)
    if (qrInfo.type === 'single' || qrInfo.total === 1) {
      let finalContent = qrInfo.content

      // Check if the scanned data is a valid fingerprint (8 bytes hex)
      const fingerprintRegex = /^[0-9a-fA-F]{8}$/
      if (fingerprintRegex.test(qrInfo.content)) {
        updateMasterFingerprint(qrInfo.content)
        setCameraModalVisible(false)
        return
      }

      try {
        // Check if it's a single BBQR QR code
        if (isBBQRFragment(qrInfo.content)) {
          const decoded = decodeBBQRChunks([qrInfo.content])

          if (decoded) {
            // Try to convert binary data to string first (for descriptors)
            try {
              const stringResult = Buffer.from(decoded).toString('utf8')
              finalContent = stringResult
            } catch (_error) {
              // Fallback to hex if string conversion fails
              const hexResult = Buffer.from(decoded).toString('hex')
              finalContent = hexResult
            }
          } else {
            toast.error('Failed to decode BBQR QR code')
            return
          }
        }
        // Check if it looks like base64 PSBT (starts with cHNidP)
        else if (qrInfo.content.startsWith('cHNidP')) {
          const hexResult = Buffer.from(qrInfo.content, 'base64').toString(
            'hex'
          )
          finalContent = hexResult
        }
        // Check if it's a single UR QR code
        else if (qrInfo.content.toLowerCase().startsWith('ur:crypto-')) {
          try {
            const success = urDecoderRef.current.receivePart(qrInfo.content)
            if (success && urDecoderRef.current.isComplete()) {
              const result = urDecoderRef.current.resultUR()

              if (result && result.cbor) {
                const decodedAccount = decodeURCryptoAccount(
                  new Uint8Array(result.cbor)
                )

                if (decodedAccount.xpub) {
                  // Extract the fingerprint and xpub separately
                  const xpubWithPrefix = decodedAccount.xpub

                  // Extract fingerprint from the prefix [fingerprint/derivation]xpub
                  // Try multiple patterns to extract fingerprint
                  let extractedFingerprint = null

                  // Pattern 1: [fingerprint/derivation]xpub (with slash separator)
                  const fingerprintMatch1 = xpubWithPrefix.match(
                    /^\[([0-9a-fA-F]{8})\//
                  )
                  if (fingerprintMatch1) {
                    extractedFingerprint = fingerprintMatch1[1]
                  }

                  // Pattern 2: [fingerprintderivation]xpub (no slash separator - legacy)
                  if (!extractedFingerprint) {
                    const fingerprintMatch2 =
                      xpubWithPrefix.match(/^\[([0-9a-fA-F]{8})/)
                    if (fingerprintMatch2) {
                      extractedFingerprint = fingerprintMatch2[1]
                    }
                  }

                  // Pattern 3: [fingerprint...]xpub (any length hex - fallback)
                  if (!extractedFingerprint) {
                    const fingerprintMatch3 =
                      xpubWithPrefix.match(/^\[([0-9a-fA-F]+)/)
                    if (fingerprintMatch3) {
                      extractedFingerprint = fingerprintMatch3[1]
                    }
                  }

                  if (extractedFingerprint) {
                    updateMasterFingerprint(extractedFingerprint)
                  }

                  // Extract just the xpub part (remove the [fingerprint/derivation] prefix)
                  const xpubMatch = xpubWithPrefix.match(
                    /\]([txyzuv]pub[a-zA-Z0-9]{107})$/
                  )
                  if (xpubMatch) {
                    const extractedXpub = xpubMatch[1]
                    updateXpub(extractedXpub)
                  } else {
                    // Fallback: use the full string if parsing fails
                    updateXpub(xpubWithPrefix)
                  }

                  // Determine script version from derivation path
                  if (decodedAccount.derivationPath) {
                    // Check for BIP84 (m/84'/0'/0') - P2WPKH
                    if (decodedAccount.derivationPath.includes("84'")) {
                      setScriptVersion('P2WPKH')
                    }
                    // Check for BIP49 (m/49'/0'/0') - P2SH-P2WPKH
                    else if (decodedAccount.derivationPath.includes("49'")) {
                      setScriptVersion('P2SH-P2WPKH')
                    }
                    // Check for BIP44 (m/44'/0'/0') - P2PKH
                    else if (decodedAccount.derivationPath.includes("44'")) {
                      setScriptVersion('P2PKH')
                    }
                    // Default fallback
                    else {
                      setScriptVersion('P2WPKH')
                    }
                  } else {
                    // Fallback to script type from xpub prefix
                    if (
                      decodedAccount.scriptType &&
                      [
                        'P2PKH',
                        'P2SH-P2WPKH',
                        'P2WPKH',
                        'P2TR',
                        'P2WSH',
                        'P2SH-P2WSH',
                        'Legacy P2SH'
                      ].includes(decodedAccount.scriptType)
                    ) {
                      setScriptVersion(decodedAccount.scriptType!)
                    }
                  }

                  // Handle descriptor mode - convert xpub to descriptor format
                  if (selectedOption === 'importDescriptor') {
                    // Convert the xpub to a proper descriptor format
                    // For BIP84 (P2WPKH), use wpkh descriptor
                    // For BIP49 (P2SH-P2WPKH), use sh(wpkh()) descriptor
                    // For BIP44 (P2PKH), use pkh descriptor
                    let externalDescriptor = ''
                    let internalDescriptor = ''

                    if (
                      decodedAccount.derivationPath &&
                      decodedAccount.derivationPath.includes("84'")
                    ) {
                      // BIP84 - P2WPKH
                      externalDescriptor = `wpkh(${xpubWithPrefix}/0/*)`
                      internalDescriptor = `wpkh(${xpubWithPrefix}/1/*)`
                    } else if (
                      decodedAccount.derivationPath &&
                      decodedAccount.derivationPath.includes("49'")
                    ) {
                      // BIP49 - P2SH-P2WPKH
                      externalDescriptor = `sh(wpkh(${xpubWithPrefix}/0/*))`
                      internalDescriptor = `sh(wpkh(${xpubWithPrefix}/1/*))`
                    } else if (
                      decodedAccount.derivationPath &&
                      decodedAccount.derivationPath.includes("44'")
                    ) {
                      // BIP44 - P2PKH
                      externalDescriptor = `pkh(${xpubWithPrefix}/0/*)`
                      internalDescriptor = `pkh(${xpubWithPrefix}/1/*)`
                    } else {
                      // Default to wpkh for unknown derivation paths
                      externalDescriptor = `wpkh(${xpubWithPrefix}/0/*)`
                      internalDescriptor = `wpkh(${xpubWithPrefix}/1/*)`
                    }

                    updateExternalDescriptor(externalDescriptor)
                    updateInternalDescriptor(internalDescriptor)
                    toast.success(
                      'Crypto account converted to descriptor successfully'
                    )
                    setCameraModalVisible(false)
                    return
                  }

                  toast.success('Crypto account imported successfully')
                  setCameraModalVisible(false)
                  return
                } else {
                  toast.error('No extended public key found in crypto account')
                  return
                }
              }
            }
          } catch {
            toast.error('Failed to decode UR crypto account')
            return
          }
        }

        // Handle regular QR codes (non-UR)
        if (selectedOption === 'importDescriptor') {
          let externalDescriptor = finalContent
          let internalDescriptor = ''

          // Try to parse as JSON first
          try {
            const jsonData = JSON.parse(finalContent)

            if (jsonData.descriptor) {
              externalDescriptor = jsonData.descriptor

              // Derive internal descriptor from external descriptor
              // Replace /0/* with /1/* for internal chain and remove checksum
              const descriptorWithoutChecksum = externalDescriptor.replace(
                /#[a-z0-9]+$/,
                ''
              )
              internalDescriptor = descriptorWithoutChecksum.replace(
                /\/0\/\*/g,
                '/1/*'
              )
            }
          } catch (_jsonError) {
            // Handle legacy formats
            if (finalContent.includes('\n')) {
              const lines = finalContent.split('\n')
              externalDescriptor = lines[0].trim()
              internalDescriptor = lines[1].trim()
            }
          }

          // Check if the descriptor is combined (contains <0;1> or <0,1>)
          if (isCombinedDescriptor(finalContent)) {
            // Validate the combined descriptor and get separated descriptors
            const combinedValidation =
              await validateCombinedDescriptor(finalContent)

            if (combinedValidation.isValid) {
              // Set both descriptors and mark them as valid
              setLocalExternalDescriptor(combinedValidation.externalDescriptor)
              setLocalInternalDescriptor(combinedValidation.internalDescriptor)
              setValidExternalDescriptor(true)
              setValidInternalDescriptor(true)

              // Store the descriptors in the store
              setExternalDescriptor(combinedValidation.externalDescriptor)
              setInternalDescriptor(combinedValidation.internalDescriptor)
            } else {
              // Set the separated descriptors but mark them as invalid
              setLocalExternalDescriptor(combinedValidation.externalDescriptor)
              setLocalInternalDescriptor(combinedValidation.internalDescriptor)
              setValidExternalDescriptor(false)
              setValidInternalDescriptor(false)
            }
          } else {
            // Handle non-combined descriptors with existing logic
            if (externalDescriptor) {
              updateExternalDescriptor(externalDescriptor)
            }
            if (internalDescriptor) {
              updateInternalDescriptor(internalDescriptor)
            }
          }
        }

        if (selectedOption === 'importExtendedPub') {
          // Convert vpub to tpub if needed
          const convertedData = convertVpubToTpub(finalContent)
          if (finalContent !== convertedData) {
            toast.info(
              t('watchonly.info.vpubConverted', {
                vpub: finalContent.slice(0, 8) + '...',
                tpub: convertedData.slice(0, 8) + '...'
              })
            )
          }
          updateXpub(convertedData)
        }

        if (selectedOption === 'importAddress') {
          updateAddress(finalContent)
        }
      } catch {
        // Keep original content if conversion fails
      }

      setCameraModalVisible(false)
      resetScanProgress()
      return
    }

    // Handle multi-part QR codes
    const { type, current, total, content } = qrInfo

    // Check if this is the start of a new scan session or continuation
    if (
      scanProgress.type === null ||
      scanProgress.type !== type ||
      scanProgress.total !== total
    ) {
      // Start new scan session
      const newScanned = new Set([current])
      const newChunks = new Map([[current, content]])

      setScanProgress({
        type,
        total,
        scanned: newScanned,
        chunks: newChunks
      })

      return
    }

    // Continue existing scan session
    if (scanProgress.scanned.has(current)) {
      return
    }

    // Add new chunk
    const newScanned = new Set(scanProgress.scanned).add(current)
    const newChunks = new Map(scanProgress.chunks).set(current, content)

    setScanProgress({
      type,
      total,
      scanned: newScanned,
      chunks: newChunks
    })

    // For UR format, use fountain encoding logic
    if (type === 'ur') {
      // For fountain encoding, we need to find the highest fragment number to determine the actual range
      const maxFragmentNumber = Math.max(...newScanned)
      const actualTotal = maxFragmentNumber + 1 // Convert from 0-based to 1-based

      // For fountain encoding, try assembly after collecting enough fragments
      // Be more aggressive - try when we have enough fragments to potentially succeed
      // Use either 1.1x the actual range or the theoretical minimum, whichever is lower
      const conservativeTarget = Math.ceil(actualTotal * 1.1)
      const theoreticalTarget = Math.ceil(total * 1.5)
      const assemblyTarget = Math.min(conservativeTarget, theoreticalTarget)

      // Also try assembly if we have most of the available fragments (80% of actual range)
      const fallbackTarget = Math.ceil(actualTotal * 0.8)
      const shouldTryAssembly =
        newScanned.size >= assemblyTarget || newScanned.size >= fallbackTarget

      if (shouldTryAssembly) {
        const assembledData = assembleMultiPartQR(type, newChunks)

        if (assembledData) {
          setCameraModalVisible(false)
          resetScanProgress()

          // Check if the assembled data is a crypto account JSON
          try {
            const parsedData = JSON.parse(assembledData)
            if (parsedData.type === 'crypto-account' && parsedData.xpub) {
              // Extract the fingerprint and xpub separately
              const xpubWithPrefix = parsedData.xpub

              // Extract fingerprint from the prefix [fingerprint/derivation]xpub
              // Try multiple patterns to extract fingerprint
              let extractedFingerprint = null

              // Pattern 1: [fingerprint/derivation]xpub (with slash separator)
              const fingerprintMatch1 = xpubWithPrefix.match(
                /^\[([0-9a-fA-F]{8})\//
              )
              if (fingerprintMatch1) {
                extractedFingerprint = fingerprintMatch1[1]
              }

              // Pattern 2: [fingerprintderivation]xpub (no slash separator - legacy)
              if (!extractedFingerprint) {
                const fingerprintMatch2 =
                  xpubWithPrefix.match(/^\[([0-9a-fA-F]{8})/)
                if (fingerprintMatch2) {
                  extractedFingerprint = fingerprintMatch2[1]
                }
              }

              // Pattern 3: [fingerprint...]xpub (any length hex - fallback)
              if (!extractedFingerprint) {
                const fingerprintMatch3 =
                  xpubWithPrefix.match(/^\[([0-9a-fA-F]+)/)
                if (fingerprintMatch3) {
                  extractedFingerprint = fingerprintMatch3[1]
                }
              }

              if (extractedFingerprint) {
                updateMasterFingerprint(extractedFingerprint)
              }

              // Extract just the xpub part (remove the [fingerprint/derivation] prefix)
              const xpubMatch = xpubWithPrefix.match(
                /\]([txyzuv]pub[a-zA-Z0-9]{107})$/
              )
              if (xpubMatch) {
                const extractedXpub = xpubMatch[1]
                updateXpub(extractedXpub)
              } else {
                // Fallback: use the full string if parsing fails
                updateXpub(xpubWithPrefix)
              }

              // Determine script version from derivation path
              if (parsedData.derivationPath) {
                // Check for BIP84 (m/84'/0'/0') - P2WPKH
                if (parsedData.derivationPath.includes("84'")) {
                  setScriptVersion('P2WPKH')
                }
                // Check for BIP49 (m/49'/0'/0') - P2SH-P2WPKH
                else if (parsedData.derivationPath.includes("49'")) {
                  setScriptVersion('P2SH-P2WPKH')
                }
                // Check for BIP44 (m/44'/0'/0') - P2PKH
                else if (parsedData.derivationPath.includes("44'")) {
                  setScriptVersion('P2PKH')
                }
                // Default fallback
                else {
                  setScriptVersion('P2WPKH')
                }
              } else {
                // Fallback to script type from xpub prefix
                if (
                  parsedData.scriptType &&
                  [
                    'P2PKH',
                    'P2SH-P2WPKH',
                    'P2WPKH',
                    'P2TR',
                    'P2WSH',
                    'P2SH-P2WSH',
                    'Legacy P2SH'
                  ].includes(parsedData.scriptType)
                ) {
                  setScriptVersion(parsedData.scriptType!)
                }
              }

              // Handle descriptor mode - convert xpub to descriptor format
              if (selectedOption === 'importDescriptor') {
                // Convert the xpub to a proper descriptor format
                let externalDescriptor = ''
                let internalDescriptor = ''

                if (
                  parsedData.derivationPath &&
                  parsedData.derivationPath.includes("84'")
                ) {
                  // BIP84 - P2WPKH
                  externalDescriptor = `wpkh(${xpubWithPrefix}/0/*)`
                  internalDescriptor = `wpkh(${xpubWithPrefix}/1/*)`
                } else if (
                  parsedData.derivationPath &&
                  parsedData.derivationPath.includes("49'")
                ) {
                  // BIP49 - P2SH-P2WPKH
                  externalDescriptor = `sh(wpkh(${xpubWithPrefix}/0/*))`
                  internalDescriptor = `sh(wpkh(${xpubWithPrefix}/1/*))`
                } else if (
                  parsedData.derivationPath &&
                  parsedData.derivationPath.includes("44'")
                ) {
                  // BIP44 - P2PKH
                  externalDescriptor = `pkh(${xpubWithPrefix}/0/*)`
                  internalDescriptor = `pkh(${xpubWithPrefix}/1/*)`
                } else {
                  // Default to wpkh for unknown derivation paths
                  externalDescriptor = `wpkh(${xpubWithPrefix}/0/*)`
                  internalDescriptor = `wpkh(${xpubWithPrefix}/1/*)`
                }

                updateExternalDescriptor(externalDescriptor)
                updateInternalDescriptor(internalDescriptor)
                toast.success(
                  'Crypto account converted to descriptor successfully'
                )
                return
              }

              toast.success('Crypto account imported successfully')
              return
            }
          } catch {
            // Not JSON, continue with regular processing
          }

          // Process the assembled data based on selected option
          if (selectedOption === 'importDescriptor') {
            // Check if the assembled data is JSON (crypto-account or crypto-output)
            try {
              const parsedData = JSON.parse(assembledData)
              if (parsedData.type === 'crypto-account') {
                if (parsedData.xpub) {
                  // Convert crypto-account to wpkh descriptor format
                  // The xpub already contains the fingerprint and path prefix
                  const externalDescriptor = `wpkh(${parsedData.xpub}/0/*)`
                  const internalDescriptor = `wpkh(${parsedData.xpub}/1/*)`
                  updateExternalDescriptor(externalDescriptor)
                  updateInternalDescriptor(internalDescriptor)
                } else {
                  toast.error(
                    'Crypto-account format not supported for descriptor import'
                  )
                }
              } else if (parsedData.type === 'crypto-output') {
                if (parsedData.script) {
                  // Convert script hex to descriptor format
                  // This is a raw script, so we need to create a descriptor from it
                  const descriptor = `raw(${parsedData.script})`
                  updateExternalDescriptor(descriptor)
                } else {
                  toast.error(
                    'Crypto-output format not supported for descriptor import'
                  )
                }
              } else {
                // Regular descriptor data
                updateExternalDescriptor(assembledData)
              }
            } catch (_jsonError) {
              updateExternalDescriptor(assembledData)
            }
          } else if (selectedOption === 'importExtendedPub') {
            // Check if the assembled data is JSON (crypto-account or crypto-output)
            try {
              const parsedData = JSON.parse(assembledData)
              if (parsedData.type === 'crypto-output') {
                if (parsedData.script) {
                  // Convert script hex to descriptor format
                  const descriptor = `raw(${parsedData.script})`
                  updateExternalDescriptor(descriptor)
                  toast.success('Crypto output converted to descriptor')
                } else {
                  toast.error(
                    'Crypto-output format not supported for xpub import'
                  )
                }
              } else if (
                parsedData.type === 'crypto-account' &&
                parsedData.xpub
              ) {
                // Extract xpub from crypto-account format
                const xpubWithPrefix = parsedData.xpub

                // Extract fingerprint from the prefix [fingerprint/derivation]xpub
                let extractedFingerprint = null
                const fingerprintMatch1 = xpubWithPrefix.match(
                  /^\[([0-9a-fA-F]{8})\//
                )
                if (fingerprintMatch1) {
                  extractedFingerprint = fingerprintMatch1[1]
                } else {
                  const fingerprintMatch2 =
                    xpubWithPrefix.match(/^\[([0-9a-fA-F]{8})/)
                  if (fingerprintMatch2) {
                    extractedFingerprint = fingerprintMatch2[1]
                  }
                }

                if (extractedFingerprint) {
                  updateMasterFingerprint(extractedFingerprint)
                }

                // Extract just the xpub part
                const xpubMatch = xpubWithPrefix.match(
                  /\]([txyzuv]pub[a-zA-Z0-9]{107})$/
                )
                if (xpubMatch) {
                  updateXpub(xpubMatch[1])
                } else {
                  updateXpub(xpubWithPrefix)
                }

                // Set script version based on derivation path or script type
                if (parsedData.derivationPath) {
                  if (parsedData.derivationPath.includes("84'")) {
                    setScriptVersion('P2WPKH')
                  } else if (parsedData.derivationPath.includes("49'")) {
                    setScriptVersion('P2SH-P2WPKH')
                  } else if (parsedData.derivationPath.includes("44'")) {
                    setScriptVersion('P2PKH')
                  }
                } else if (parsedData.scriptType) {
                  setScriptVersion(parsedData.scriptType)
                }

                // Also populate the descriptor field with the full xpub format
                updateExternalDescriptor(xpubWithPrefix)

                toast.success('Crypto account imported successfully')
              } else {
                // Regular xpub data
                updateXpub(assembledData)
              }
            } catch (_jsonError) {
              updateXpub(assembledData)
            }
          } else if (selectedOption === 'importAddress') {
            updateAddress(assembledData)
          }
        }
      }
    } else {
      // For RAW and BBQR, wait for all chunks as before
      if (newScanned.size === total) {
        // All chunks collected, assemble the final result
        const assembledData = assembleMultiPartQR(type, newChunks)

        if (assembledData) {
          setCameraModalVisible(false)
          resetScanProgress()

          // Process the assembled data based on selected option
          if (selectedOption === 'importDescriptor') {
            // Check if the assembled data is JSON (crypto-account or crypto-output)
            try {
              const parsedData = JSON.parse(assembledData)
              if (parsedData.type === 'crypto-output') {
                if (parsedData.script) {
                  const descriptor = `raw(${parsedData.script})`
                  updateExternalDescriptor(descriptor)
                } else {
                  toast.error(
                    'Crypto-output format not supported for descriptor import'
                  )
                }
              } else if (parsedData.type === 'crypto-account') {
                if (parsedData.xpub) {
                  const externalDescriptor = `wpkh(${parsedData.xpub}/0/*)`
                  const internalDescriptor = `wpkh(${parsedData.xpub}/1/*)`
                  updateExternalDescriptor(externalDescriptor)
                  updateInternalDescriptor(internalDescriptor)
                } else {
                  toast.error(
                    'Crypto-account format not supported for descriptor import'
                  )
                }
              } else {
                updateExternalDescriptor(assembledData)
              }
            } catch (_jsonError) {
              updateExternalDescriptor(assembledData)
            }
          } else if (selectedOption === 'importExtendedPub') {
            // Check if the assembled data is JSON (crypto-account or crypto-output)
            try {
              const parsedData = JSON.parse(assembledData)
              if (parsedData.type === 'crypto-output') {
                if (parsedData.script) {
                  const descriptor = `raw(${parsedData.script})`
                  updateExternalDescriptor(descriptor)
                  toast.success('Crypto output converted to descriptor')
                } else {
                  toast.error(
                    'Crypto-output format not supported for xpub import'
                  )
                }
              } else if (
                parsedData.type === 'crypto-account' &&
                parsedData.xpub
              ) {
                const xpubWithPrefix = parsedData.xpub

                // Extract fingerprint from the prefix [fingerprint/derivation]xpub
                let extractedFingerprint = null
                const fingerprintMatch1 = xpubWithPrefix.match(
                  /^\[([0-9a-fA-F]{8})\//
                )
                if (fingerprintMatch1) {
                  extractedFingerprint = fingerprintMatch1[1]
                } else {
                  const fingerprintMatch2 =
                    xpubWithPrefix.match(/^\[([0-9a-fA-F]{8})/)
                  if (fingerprintMatch2) {
                    extractedFingerprint = fingerprintMatch2[1]
                  }
                }

                if (extractedFingerprint) {
                  updateMasterFingerprint(extractedFingerprint)
                }

                // Extract just the xpub part
                const xpubMatch = xpubWithPrefix.match(
                  /\]([txyzuv]pub[a-zA-Z0-9]{107})$/
                )
                if (xpubMatch) {
                  updateXpub(xpubMatch[1])
                } else {
                  updateXpub(xpubWithPrefix)
                }

                // Set script version based on derivation path or script type
                if (parsedData.derivationPath) {
                  if (parsedData.derivationPath.includes("84'")) {
                    setScriptVersion('P2WPKH')
                  } else if (parsedData.derivationPath.includes("49'")) {
                    setScriptVersion('P2SH-P2WPKH')
                  } else if (parsedData.derivationPath.includes("44'")) {
                    setScriptVersion('P2PKH')
                  }
                } else if (parsedData.scriptType) {
                  setScriptVersion(parsedData.scriptType)
                }

                // Also populate the descriptor field with the full xpub format
                updateExternalDescriptor(xpubWithPrefix)

                toast.success('Crypto account imported successfully')
              } else {
                updateXpub(assembledData)
              }
            } catch (_jsonError) {
              updateXpub(assembledData)
            }
          } else if (selectedOption === 'importAddress') {
            updateAddress(assembledData)
          }
        } else {
          toast.error('Failed to assemble multi-part QR code')
          resetScanProgress()
        }
      }
    }
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{ headerTitle: () => <SSText uppercase>{name}</SSText> }}
      />
      <ScrollView>
        <SSSelectModal
          visible={modalOptionsVisible}
          title={t('watchonly.titleModal').toUpperCase()}
          selectedText={t(`watchonly.${selectedOption}.title`)}
          selectedDescription={
            <SSCollapsible>
              <SSText color="muted" size="md">
                {t(`watchonly.${selectedOption}.text`)}
              </SSText>
            </SSCollapsible>
          }
          onSelect={() => {
            setModalOptionsVisible(false)
            setCreationType(selectedOption)
          }}
          onCancel={() => router.back()}
        >
          {watchOnlyOptions.map((type) => (
            <SSRadioButton
              key={type}
              label={t(`watchonly.${type}.label`)}
              selected={selectedOption === type}
              onPress={() => setSelectedOption(type)}
            />
          ))}
        </SSSelectModal>
        <SSScriptVersionModal
          visible={scriptVersionModalVisible}
          scriptVersion={scriptVersion}
          onCancel={() => setScriptVersionModalVisible(false)}
          onSelect={(scriptVersion) => {
            setScriptVersion(scriptVersion)
            setScriptVersionModalVisible(false)
          }}
        />
        {!modalOptionsVisible && (
          <SSVStack justifyBetween gap="lg" style={{ paddingBottom: 20 }}>
            <SSVStack gap="lg">
              <SSVStack gap="sm">
                <SSVStack gap="xxs">
                  <SSText center>
                    {t(`watchonly.${selectedOption}.label`)}
                  </SSText>
                  {selectedOption === 'importExtendedPub' && (
                    <SSTextInput
                      value={xpub}
                      style={validXpub ? styles.valid : styles.invalid}
                      onChangeText={updateXpub}
                      multiline
                    />
                  )}
                  {selectedOption === 'importDescriptor' && (
                    <SSTextInput
                      value={externalDescriptor}
                      style={
                        validExternalDescriptor ? styles.valid : styles.invalid
                      }
                      onChangeText={updateExternalDescriptor}
                      multiline
                    />
                  )}
                  {selectedOption === 'importAddress' && (
                    <SSTextInput
                      value={address}
                      style={validAddress ? styles.valid : styles.invalid}
                      onChangeText={updateAddress}
                      multiline
                    />
                  )}
                </SSVStack>
                {selectedOption === 'importExtendedPub' && (
                  <>
                    <SSVStack gap="xxs">
                      <SSFormLayout.Label
                        label={t('account.script').toUpperCase()}
                      />
                      <SSButton
                        label={`${t(
                          `script.${scriptVersion.toLocaleLowerCase()}.name`
                        )} (${scriptVersion})`}
                        withSelect
                        onPress={() => setScriptVersionModalVisible(true)}
                      />
                    </SSVStack>
                    <SSVStack gap="xxs">
                      <SSText center>{t('watchonly.fingerprint.label')}</SSText>
                      <SSTextInput
                        value={localFingerprint}
                        onChangeText={updateMasterFingerprint}
                        style={
                          validMasterFingerprint ? styles.valid : styles.invalid
                        }
                      />
                    </SSVStack>
                  </>
                )}
                {selectedOption === 'importDescriptor' && (
                  <>
                    <SSVStack gap="xxs">
                      <SSText center>
                        {t('watchonly.importDescriptor.internal')}
                      </SSText>
                      <SSTextInput
                        value={internalDescriptor}
                        style={
                          validInternalDescriptor
                            ? styles.valid
                            : styles.invalid
                        }
                        multiline
                        onChangeText={updateInternalDescriptor}
                      />
                    </SSVStack>
                  </>
                )}
              </SSVStack>
              <SSVStack>
                <SSButton
                  label={t('watchonly.read.clipboard')}
                  onPress={pasteFromClipboard}
                />
                <SSButton
                  label={t('watchonly.read.qrcode')}
                  onPress={() => setCameraModalVisible(true)}
                />
                <Animated.View
                  style={{
                    opacity: pulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.7]
                    }),
                    transform: [{ scale: scaleAnim }],
                    overflow: 'hidden'
                  }}
                >
                  <SSButton
                    label={
                      isReading
                        ? t('watchonly.read.scanning')
                        : t('watchonly.read.nfc')
                    }
                    onPress={handleNFCRead}
                    disabled={!isAvailable}
                  />
                </Animated.View>
              </SSVStack>

              {/* Multi-part QR Scanning Progress */}
              {scanProgress.type && scanProgress.total > 1 && (
                <SSVStack gap="sm">
                  <SSText center size="sm" color="muted">
                    {scanProgress.type.toUpperCase()}{' '}
                    {t('qrcode.scan.progress')}
                  </SSText>
                  <SSText center size="md">
                    {scanProgress.scanned.size} / {scanProgress.total}{' '}
                    {t('common.parts')}
                  </SSText>
                  <SSButton
                    label={t('qrcode.scan.reset')}
                    variant="ghost"
                    onPress={resetScanProgress}
                  />
                </SSVStack>
              )}
            </SSVStack>
            <SSVStack gap="sm">
              <SSButton
                label={t('common.confirm')}
                variant="secondary"
                loading={loadingWallet}
                disabled={disabled}
                onPress={() => confirmAccountCreation()}
              />
              <SSButton
                label={t('common.cancel')}
                variant="ghost"
                onPress={() => setModalOptionsVisible(true)}
              />
            </SSVStack>
          </SSVStack>
        )}
      </ScrollView>
      <SSModal
        visible={cameraModalVisible}
        fullOpacity
        onClose={() => {
          setCameraModalVisible(false)
          resetScanProgress()
        }}
      >
        <SSVStack itemsCenter gap="md">
          <SSText color="muted" uppercase>
            {scanProgress.type
              ? `Scanning ${scanProgress.type.toUpperCase()} QR Code`
              : t('camera.scanQRCode')}
          </SSText>
          <CameraView
            onBarcodeScanned={(res) => {
              handleQRCodeScanned(res.raw)
            }}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            style={{ width: 340, height: 340 }}
          />
          {/* Show progress if scanning multi-part QR */}
          {scanProgress.type && scanProgress.total > 1 && (
            <SSVStack itemsCenter gap="xs" style={{ marginBottom: 10 }}>
              {scanProgress.type === 'ur' ? (
                // For UR fountain encoding, show the actual target
                <>
                  {(() => {
                    const maxFragment = Math.max(...scanProgress.scanned)
                    const actualTotal = maxFragment + 1
                    const conservativeTarget = Math.ceil(actualTotal * 1.1)
                    const theoreticalTarget = Math.ceil(
                      scanProgress.total * 1.5
                    )
                    const displayTarget = Math.min(
                      conservativeTarget,
                      theoreticalTarget
                    )

                    return (
                      <>
                        <SSText color="white" center>
                          {`UR fountain encoding: ${scanProgress.scanned.size}/${displayTarget} fragments`}
                        </SSText>
                        <View
                          style={{
                            width: 300,
                            height: 4,
                            backgroundColor: Colors.gray[700],
                            borderRadius: 2
                          }}
                        >
                          <View
                            style={{
                              width:
                                (scanProgress.scanned.size / displayTarget) *
                                300,
                              height: 4,
                              maxWidth: 300,
                              backgroundColor: Colors.white,
                              borderRadius: 2
                            }}
                          />
                        </View>
                      </>
                    )
                  })()}
                </>
              ) : (
                // For RAW and BBQR, show normal progress
                <>
                  <SSText color="white" center>
                    {`Progress: ${scanProgress.scanned.size}/${scanProgress.total} chunks`}
                  </SSText>
                  <View
                    style={{
                      width: 300,
                      height: 4,
                      backgroundColor: Colors.gray[700],
                      borderRadius: 2
                    }}
                  >
                    <View
                      style={{
                        width:
                          (scanProgress.scanned.size / scanProgress.total) *
                          300,
                        height: 4,
                        maxWidth: scanProgress.total * 300,
                        backgroundColor: Colors.white,
                        borderRadius: 2
                      }}
                    />
                  </View>
                  <SSText color="muted" size="sm" center>
                    {`Scanned parts: ${Array.from(scanProgress.scanned)
                      .sort((a, b) => a - b)
                      .map((n) => n + 1)
                      .join(', ')}`}
                  </SSText>
                </>
              )}
            </SSVStack>
          )}
          <SSHStack>
            {!permission?.granted && (
              <SSButton
                label={t('camera.enableCameraAccess')}
                onPress={requestPermission}
              />
            )}
          </SSHStack>
          {/* Reset button for multi-part scans */}
          {scanProgress.type && (
            <SSHStack>
              <SSButton
                label="Reset Scan"
                variant="outline"
                onPress={resetScanProgress}
                style={{ marginTop: 10, width: 200 }}
              />
            </SSHStack>
          )}
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  invalid: {
    borderColor: Colors.error,
    borderWidth: 1,
    height: 'auto',
    paddingVertical: 10
  },
  valid: { height: 'auto', paddingVertical: 10 }
})
