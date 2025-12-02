import { URDecoder } from '@ngraveio/bc-ur'
import { Descriptor } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { router, Stack, useLocalSearchParams } from 'expo-router'
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
import {
  type CreationType,
  type ScriptVersionType
} from '@/types/models/Account'
import { type WatchOnlySearchParams } from '@/types/navigation/searchParams'
import { isBBQRFragment } from '@/utils/bbqr'
import { getDerivationPathFromScriptVersion } from '@/utils/bitcoin'
import { DescriptorUtils } from '@/utils/descriptorUtils'
import { getScriptVersionDisplayName } from '@/utils/scripts'
import {
  isCombinedDescriptor,
  validateAddress,
  validateDescriptor,
  validateDescriptorFormat,
  validateExtendedKey,
  validateFingerprint
} from '@/utils/validation'

const WATCH_ONLY_OPTIONS: CreationType[] = [
  'importExtendedPub',
  'importDescriptor',
  'importAddress'
]

export default function WatchOnly() {
  const params = useLocalSearchParams<WatchOnlySearchParams>()
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
    setNetwork
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
      state.setNetwork
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
  const [scanningFor, setScanningFor] = useState<'main' | 'fingerprint'>('main')
  const [selectedOption, setSelectedOption] = useState<CreationType>(
    params.descriptor
      ? 'importDescriptor'
      : params.extendedPublicKey
        ? 'importExtendedPub'
        : 'importExtendedPub'
  )
  const [modalOptionsVisible, setModalOptionsVisible] = useState(
    !params.descriptor && !params.extendedPublicKey
  )
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

  useEffect(() => {
    async function handleScannerParams() {
      if (params.descriptor) {
        const descriptorFromScanner = params.descriptor as string

        setCreationType('importDescriptor')
        await handleSingleDescriptor(descriptorFromScanner)
      } else if (params.extendedPublicKey) {
        const xpubFromScanner = params.extendedPublicKey as string
        setCreationType('importExtendedPub')
        updateXpub(xpubFromScanner)
      }
    }

    handleScannerParams()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.descriptor, params.extendedPublicKey, setCreationType])

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

  // Handle NFC reading animations
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

  const updateDescriptorValidationState = useCallback(() => {
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
    const validXpub = validateExtendedKey(xpub)
    const validForNetwork = validateExtendedKey(xpub, network)

    if (!validForNetwork && validXpub) {
      toast.error(t('watchonly.error.networkMismatch'))
    }

    setValidXpub(!xpub || validXpub)

    extractAndSetFingerprint(xpub)

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
    // For combined descriptors, we need to validate the full combined descriptor
    // not the separated ones, since checksums are only valid for the full descriptor
    if (skipChecksumValidation) {
      await handleSeparatedDescriptorValidation(descriptor, 'external')
      return
    }

    // Regular validation for standalone descriptors
    await handleFullDescriptorValidation(descriptor, 'external')
  }

  async function updateInternalDescriptor(
    descriptor: string,
    skipChecksumValidation = false
  ) {
    // For combined descriptors, we need to validate the full combined descriptor
    // not the separated ones, since checksums are only valid for the full descriptor
    if (skipChecksumValidation) {
      await handleSeparatedDescriptorValidation(descriptor, 'internal')
      return
    }

    // Regular validation for standalone descriptors
    await handleFullDescriptorValidation(descriptor, 'internal')
  }

  async function handleSeparatedDescriptorValidation(
    descriptor: string,
    type: 'external' | 'internal'
  ) {
    // This is a separated descriptor from a combined descriptor
    // Only do format validation, not checksum validation
    const descriptorValidation = await validateDescriptorFormat(descriptor)

    const basicValidation =
      descriptorValidation.isValid && !descriptor.match(/[txyz]priv/)

    if (type === 'external') {
      setValidExternalDescriptor(!descriptor || basicValidation)
      setLocalExternalDescriptor(descriptor)

      if (basicValidation) {
        setExternalDescriptor(descriptor)
        await extractAndSetFingerprint(descriptor)
      }
    } else {
      setValidInternalDescriptor(!descriptor || basicValidation)
      setLocalInternalDescriptor(descriptor)

      if (basicValidation) {
        setInternalDescriptor(descriptor)
        await extractAndSetFingerprint(descriptor)
      }
    }
  }

  async function handleFullDescriptorValidation(
    descriptor: string,
    type: 'external' | 'internal'
  ) {
    const descriptorValidation = await validateDescriptor(descriptor)

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

    const isValidDescriptor = basicValidation && networkValidation.isValid

    if (type === 'external') {
      setValidExternalDescriptor(!descriptor || isValidDescriptor)
      setLocalExternalDescriptor(descriptor)

      if (isValidDescriptor) {
        setExternalDescriptor(descriptor)
        await extractAndSetFingerprint(descriptor)
      }
    } else {
      setValidInternalDescriptor(!descriptor || isValidDescriptor)
      setLocalInternalDescriptor(descriptor)

      if (isValidDescriptor) {
        setInternalDescriptor(descriptor)
        await extractAndSetFingerprint(descriptor)
      }
    }
  }

  async function extractAndSetFingerprint(descriptor: string) {
    if (localFingerprint) return
    const extractedFingerprint = DescriptorUtils.extractFingerprint(descriptor)
    if (!extractedFingerprint) return
    setLocalFingerprint(extractedFingerprint)
    setFingerprint(extractedFingerprint)
  }

  function detectQRType(data: string) {
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
    urDecoderRef.current = new URDecoder()
  }

  async function handleQRCodeScanned(data: string | undefined) {
    if (!data) {
      toast.error(t('watchonly.read.qrError'))
      return
    }

    if (scanningFor === 'fingerprint') {
      updateMasterFingerprint(data)
      setCameraModalVisible(false)
      toast.success(t('watchonly.success.qrScanned'))
      return
    }

    const qrInfo = detectQRType(data)

    if (qrInfo.type === 'single' || qrInfo.total === 1) {
      await handleSingleQRCode(qrInfo.content)
    } else {
      await handleMultiPartQRCode(qrInfo)
    }
  }

  async function handleSingleQRCode(data: string) {
    if (isCombinedDescriptor(data)) {
      await handleCombinedDescriptor(data, data)
      return
    }

    await updateExternalDescriptor(data)
    extractAndSetFingerprint(data)
  }

  async function handleMultiPartQRCode(qrInfo: {
    type: 'ur' | 'bbqr' | 'raw'
    current: number
    total: number
    content: string
  }) {
    const { current, total, content } = qrInfo

    if (current >= total) {
      toast.error(t('watchonly.read.qrError'))
      return
    }

    // Add the scanned chunk to the set
    setScanProgress((prev) => ({
      ...prev,
      scanned: new Set([...prev.scanned, current])
    }))

    // For now, handle as single QR code to avoid complex UR decoding issues
    await handleSingleQRCode(content)
  }

  async function pasteFromClipboard() {
    const text = await Clipboard.getStringAsync()
    if (!text) return

    if (selectedOption === 'importExtendedPub') {
      updateXpub(text)
      return
    }

    if (selectedOption === 'importAddress') {
      updateAddress(text)
      return
    }

    if (selectedOption === 'importDescriptor') {
      // Try to parse as JSON first
      const jsonResult = DescriptorUtils.parseJsonDescriptor(text)
      if (jsonResult) {
        await handleJsonDescriptor(jsonResult, text)
        return
      }

      // Try to parse as legacy multi-line format
      const legacyResult = DescriptorUtils.parseLegacyDescriptor(text)
      if (legacyResult) {
        await handleLegacyDescriptor(legacyResult)
        return
      }

      // Handle as single descriptor
      await handleSingleDescriptor(text)
    }
  }

  async function pasteFingerprintFromClipboard() {
    try {
      const clipboardContent = await Clipboard.getStringAsync()
      if (!clipboardContent) {
        toast.error(t('watchonly.error.emptyClipboard'))
        return
      }

      const finalContent = clipboardContent.trim()
      updateMasterFingerprint(finalContent)
      toast.success(t('watchonly.success.clipboardPasted'))
    } catch {
      toast.error(t('watchonly.error.clipboardPaste'))
    }
  }

  async function handleJsonDescriptor(
    result: { external: string; internal: string; original: string },
    originalText: string
  ) {
    const { external, internal, original } = result

    if (isCombinedDescriptor(original)) {
      await handleCombinedDescriptor(original, originalText)
    } else {
      // For JSON descriptors, use the original descriptor for validation
      await updateExternalDescriptor(original)
      if (internal) await updateInternalDescriptor(internal)
      extractAndSetFingerprint(external)
    }
  }

  async function handleLegacyDescriptor(result: {
    external: string
    internal: string
  }) {
    const { external, internal } = result

    if (isCombinedDescriptor(external)) {
      await handleCombinedDescriptor(external, external)
      return
    }

    await updateExternalDescriptor(external)
    if (internal) await updateInternalDescriptor(internal)

    extractAndSetFingerprint(external)
  }

  async function handleSingleDescriptor(descriptor: string) {
    if (isCombinedDescriptor(descriptor)) {
      await handleCombinedDescriptor(descriptor, descriptor)
    } else {
      await updateExternalDescriptor(descriptor)
      extractAndSetFingerprint(descriptor)
    }
  }

  async function handleCombinedDescriptor(
    descriptor: string,
    originalText: string
  ) {
    const result = await DescriptorUtils.processCombinedDescriptor(
      descriptor,
      scriptVersion as ScriptVersionType
    )

    if (result.success) {
      // Set both descriptors and mark them as valid
      setLocalExternalDescriptor(result.external)
      setLocalInternalDescriptor(result.internal)
      setValidExternalDescriptor(true)
      setValidInternalDescriptor(true)

      // Store the FULL combined descriptor in the store for validation during account creation
      setExternalDescriptor(originalText)
      setInternalDescriptor('')

      // Extract and set fingerprint
      if (!localFingerprint && result.fingerprint) {
        setLocalFingerprint(result.fingerprint)
        setFingerprint(result.fingerprint)
      }

      // Remove checksums from separated descriptors for format validation
      const externalWithoutChecksum = DescriptorUtils.removeChecksum(
        result.external
      )
      const internalWithoutChecksum = DescriptorUtils.removeChecksum(
        result.internal
      )

      await updateExternalDescriptor(externalWithoutChecksum, true)
      await updateInternalDescriptor(internalWithoutChecksum, true)
    } else {
      // Set the separated descriptors but mark them as invalid
      setLocalExternalDescriptor(result.external)
      setLocalInternalDescriptor(result.internal)
      setValidExternalDescriptor(false)
      setValidInternalDescriptor(false)

      if (result.error) {
        toast.error(result.error)
      }
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
          const combinedValidation =
            await DescriptorUtils.processCombinedDescriptor(
              text,
              scriptVersion as ScriptVersionType
            )

          if (combinedValidation.success) {
            // Set both descriptors and mark them as valid
            setLocalExternalDescriptor(combinedValidation.external)
            setLocalInternalDescriptor(combinedValidation.internal)
            setValidExternalDescriptor(true)
            setValidInternalDescriptor(true)

            // IMPORTANT: Store the FULL combined descriptor in the store for validation during account creation
            // The separated descriptors are only for display purposes
            setExternalDescriptor(text) // Store the original combined descriptor
            setInternalDescriptor('') // No internal descriptor for combined descriptors

            extractAndSetFingerprint(combinedValidation.external)

            // IMPORTANT: For combined descriptors, we need to remove the checksum from the separated descriptors
            // because the checksums are only valid for the full combined descriptor
            const externalWithoutChecksum = combinedValidation.external.replace(
              /#[a-z0-9]+$/,
              ''
            )
            const internalWithoutChecksum = combinedValidation.internal.replace(
              /#[a-z0-9]+$/,
              ''
            )

            // Use format-only validation for the separated descriptors (without checksums)
            await updateExternalDescriptor(externalWithoutChecksum, true)
            await updateInternalDescriptor(internalWithoutChecksum, true)
          } else {
            // Set the separated descriptors but mark them as invalid
            setLocalExternalDescriptor(combinedValidation.external)
            setLocalInternalDescriptor(combinedValidation.internal)
            setValidExternalDescriptor(false)
            setValidInternalDescriptor(false)
          }
        } else {
          // Handle non-combined descriptors with existing logic
          if (externalDescriptor) updateExternalDescriptor(externalDescriptor)
          if (internalDescriptor) updateInternalDescriptor(internalDescriptor)
          extractAndSetFingerprint(externalDescriptor)
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

  const confirmAccountCreation = useCallback(async () => {
    setLoadingWallet(true)
    try {
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
          setKey(index)
        }
      } else if (selectedOption === 'importDescriptor') {
        // Extract fingerprint from descriptor if not already set

        // Check if we have a combined descriptor and validate it
        if (externalDescriptor && isCombinedDescriptor(externalDescriptor)) {
          const combinedValidation =
            await DescriptorUtils.processCombinedDescriptor(
              externalDescriptor,
              scriptVersion as ScriptVersionType
            )

          if (!combinedValidation.success) {
            toast.error('Invalid combined descriptor')
            return
          }
        }

        extractAndSetFingerprint(externalDescriptor)

        // Ensure we have a fingerprint for descriptor import
        if (!localFingerprint) {
          toast.error(t('watchonly.error.missingFields'))
          return
        }
      }

      setNetwork(network)
      setKey(0)

      const account = getAccountData()

      const data = await accountBuilderFinish(account)
      if (!data) {
        toast.error(t('watchonly.error.creationFailed'))
        return
      }

      updateAccount(data.accountWithEncryptedSecret)
      toast.success(t('watchonly.success.accountCreated'))
      router.dismissAll()
      router.navigate(`/account/${data.accountWithEncryptedSecret.id}`)

      // Start sync in background if auto mode is enabled
      if (connectionMode === 'auto') {
        try {
          const updatedAccount =
            selectedOption !== 'importAddress'
              ? await syncAccountWithWallet(
                  data.accountWithEncryptedSecret,
                  data.wallet!
                )
              : await syncAccountWithAddress(data.accountWithEncryptedSecret)
          updateAccount(updatedAccount)
        } catch {}
      }
    } catch {
      toast.error(t('watchonly.error.creationFailed'))
    } finally {
      clearAccount()
      setLoadingWallet(false)
    }
  }, [
    selectedOption,
    xpub,
    localFingerprint,
    scriptVersion,
    address,
    externalDescriptor,
    network,
    setExtendedPublicKey,
    setFingerprint,
    setScriptVersion,
    setExternalDescriptor,
    setNetwork,
    setKey,
    getAccountData,
    accountBuilderFinish,
    updateAccount,
    connectionMode,
    syncAccountWithWallet,
    syncAccountWithAddress,
    clearAccount,
    setLoadingWallet
  ])

  return (
    <SSMainLayout style={{ paddingTop: 0, paddingBottom: 10 }}>
      <Stack.Screen
        options={{ headerTitle: () => <SSText uppercase>{name}</SSText> }}
      />
      <ScrollView contentContainerStyle={{ height: '100%' }}>
        <SSVStack
          justifyBetween
          gap="lg"
          style={{ paddingBottom: 20, flex: 1 }}
        >
          <SSVStack gap="lg">
            <SSVStack gap="lg">
              <SSVStack gap="lg">
                <SSVStack gap="sm">
                  <SSText size="md" center uppercase>
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
                <SSVStack gap="sm">
                  <SSHStack gap="sm">
                    <SSButton
                      label="Paste"
                      variant="gradient"
                      onPress={pasteFromClipboard}
                      style={{ flex: 1 }}
                    />
                    <SSButton
                      label="Scan QR"
                      variant="gradient"
                      onPress={() => {
                        setScanningFor('main')
                        setCameraModalVisible(true)
                      }}
                      style={{ flex: 1 }}
                    />
                  </SSHStack>
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
              </SSVStack>
              {selectedOption === 'importExtendedPub' && (
                <SSVStack gap="xxs">
                  <SSFormLayout.Label
                    label={t('account.script').toUpperCase()}
                  />
                  <SSButton
                    label={getScriptVersionDisplayName(scriptVersion)}
                    withSelect
                    onPress={() => setScriptVersionModalVisible(true)}
                  />
                </SSVStack>
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
                        validInternalDescriptor ? styles.valid : styles.invalid
                      }
                      multiline
                      onChangeText={updateInternalDescriptor}
                    />
                  </SSVStack>
                </>
              )}
            </SSVStack>
            {/* Multi-part QR Scanning Progress */}
            {scanProgress.type && scanProgress.total > 1 && (
              <SSVStack gap="sm">
                <SSText center size="sm" color="muted">
                  {scanProgress.type.toUpperCase()} {t('qrcode.scan.progress')}
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
          <SSVStack gap="lg">
            {selectedOption === 'importExtendedPub' && (
              <SSVStack gap="sm">
                <SSText center>{t('watchonly.fingerprint.label')}</SSText>
                <SSTextInput
                  value={localFingerprint}
                  onChangeText={updateMasterFingerprint}
                  style={validMasterFingerprint ? styles.valid : styles.invalid}
                />
                <SSHStack gap="sm">
                  <SSButton
                    label="Paste"
                    variant="gradient"
                    onPress={pasteFingerprintFromClipboard}
                    style={{ flex: 1 }}
                  />
                  <SSButton
                    label="Scan QR"
                    variant="gradient"
                    onPress={() => {
                      setScanningFor('fingerprint')
                      setCameraModalVisible(true)
                    }}
                    style={{ flex: 1 }}
                  />
                </SSHStack>
              </SSVStack>
            )}
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
        </SSVStack>
      </ScrollView>
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
        {WATCH_ONLY_OPTIONS.map((type) => (
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
          extractAndSetFingerprint(externalDescriptor)
        }}
      />
      <SSModal
        visible={cameraModalVisible}
        fullOpacity
        onClose={() => {
          setCameraModalVisible(false)
          setScanningFor('main')
          resetScanProgress()
        }}
      >
        <SSVStack itemsCenter gap="md">
          <SSText color="muted" uppercase>
            {scanningFor === 'fingerprint'
              ? t('watchonly.fingerprint.scanQR')
              : scanProgress.type
                ? `Scanning ${scanProgress.type.toUpperCase()} QR Code`
                : t('transaction.build.options.importOutputs.qrcode')}
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
