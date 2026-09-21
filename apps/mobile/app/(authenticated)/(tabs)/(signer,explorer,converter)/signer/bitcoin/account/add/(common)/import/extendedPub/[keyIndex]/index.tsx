import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Keyboard, StyleSheet } from 'react-native'
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { parseDescriptor } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { UNKNOWN_MASTER_FINGERPRINT } from '@/constants/btc'
import { useNFCReader } from '@/hooks/useNFCReader'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import {
  convertKeyFormat,
  getDerivationPathFromScriptVersion,
  getMultisigDerivationPathFromScriptVersion
} from '@/utils/bitcoin'
import { type DetectedContent } from '@/utils/contentDetector'
import { DescriptorUtils } from '@/utils/descriptorUtils'
import { validateExtendedKey, validateFingerprint } from '@/utils/validation'

type ImportExtendedPubSearchParams = {
  keyIndex: string
}

export default function ImportExtendedPub() {
  const { keyIndex } = useLocalSearchParams<ImportExtendedPubSearchParams>()
  const router = useRouter()
  const network = useBlockchainStore((state) => state.selectedNetwork)

  const [
    setExtendedPublicKey,
    setFingerprint,
    clearKeyState,
    setKey,
    setKeyDerivationPath,
    policyType,
    scriptVersion,
    builderNetwork
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.setExtendedPublicKey,
      state.setFingerprint,
      state.clearKeyState,
      state.setKey,
      state.setKeyDerivationPath,
      state.policyType,
      state.scriptVersion,
      state.network
    ])
  )

  const { isHardwareSupported, isReading, readNFCTag, cancelNFCScan } =
    useNFCReader()
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [scanningFor, setScanningFor] = useState<'main' | 'fingerprint'>('main')

  const [xpub, setXpub] = useState('')
  const [localFingerprint, setLocalFingerprint] = useState('')

  const [disabled, setDisabled] = useState(true)
  const [validXpub, setValidXpub] = useState(true)
  const [validMasterFingerprint, setValidMasterFingerprint] = useState(true)
  const [xpubError, setXpubError] = useState('')

  const pulseAnim = useSharedValue(0)
  const scaleAnim = useSharedValue(1)

  useEffect(() => {
    if (isReading) {
      pulseAnim.set(
        withRepeat(
          withSequence(
            withTiming(1, { duration: 500 }),
            withTiming(0, { duration: 500 })
          ),
          -1
        )
      )
      scaleAnim.set(
        withRepeat(
          withSequence(
            withTiming(0.98, { duration: 500 }),
            withTiming(1, { duration: 500 })
          ),
          -1
        )
      )
      return () => {
        cancelAnimation(pulseAnim)
        cancelAnimation(scaleAnim)
      }
    }
    pulseAnim.set(0)
    scaleAnim.set(1)
  }, [isReading, pulseAnim, scaleAnim])

  const nfcButtonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseAnim.value, [0, 1], [1, 0.7]),
    overflow: 'hidden' as const,
    transform: [{ scale: scaleAnim.value }]
  }))

  function updateMasterFingerprint(fingerprint: string) {
    const validFingerprint = !fingerprint || validateFingerprint(fingerprint)
    setValidMasterFingerprint(validFingerprint)
    setLocalFingerprint(fingerprint)
    setDisabled(!xpub || !validXpub || !validFingerprint)
    if (fingerprint && validateFingerprint(fingerprint)) {
      setFingerprint(fingerprint)
      Keyboard.dismiss()
    }
  }

  function updateXpub(raw: string) {
    const parsed = DescriptorUtils.parseXpubInput(raw)
    const nextXpub = parsed.xpub
    const validXpub = validateExtendedKey(nextXpub, network)
    const nextFingerprint = parsed.fingerprint || localFingerprint
    const validFingerprint =
      !nextFingerprint || validateFingerprint(nextFingerprint)

    setValidXpub(!nextXpub || validXpub)
    setXpub(nextXpub)

    if (parsed.fingerprint) {
      setLocalFingerprint(parsed.fingerprint)
      setFingerprint(parsed.fingerprint)
      setValidMasterFingerprint(true)
    }

    const fingerprintForDescriptor =
      nextFingerprint || UNKNOWN_MASTER_FINGERPRINT
    if (validXpub) {
      const derivationPath = getDerivationPathFromScriptVersion(
        scriptVersion,
        network
      )
      const formattedXpub = `[${fingerprintForDescriptor}/${derivationPath}]${nextXpub}/0/*`
      setExtendedPublicKey(formattedXpub)
    }

    setDisabled(!nextXpub || !validXpub || !validFingerprint)
    setXpubError('')

    if (nextXpub && !validXpub) {
      const errorMessage = t('account.import.error.descriptorFormat')
      setXpubError(errorMessage)
      toast.error(errorMessage)
    }
  }

  function convertVpubToTpub(vpub: string): string {
    // If it's not a vpub, return as is
    if (!vpub.startsWith('vpub')) {
      return vpub
    }

    return convertKeyFormat(vpub, 'tpub', network)
  }

  function handleConfirm() {
    if (!validXpub || !validMasterFingerprint) {
      toast.error(t('watchonly.error.invalidInput'))
      return
    }

    try {
      const convertedXpub = convertVpubToTpub(xpub)
      if (xpub !== convertedXpub) {
        toast.info(
          t('watchonly.info.vpubConverted', {
            tpub: `${convertedXpub.slice(0, 8)}...`,
            vpub: `${xpub.slice(0, 8)}...`
          })
        )
      }

      // Extract derivation path from extended public key
      let derivationPath = ''

      if (policyType === 'multisig') {
        // For multisig accounts, always use our multisig derivation path logic
        const rawDerivationPath = getMultisigDerivationPathFromScriptVersion(
          scriptVersion,
          builderNetwork
        )
        derivationPath = `m/${rawDerivationPath}`
      } else {
        // For single-sig accounts, try to extract from descriptor first
        try {
          // Create a descriptor from the extended public key to extract derivation path
          const descriptorString = `pkh(${convertedXpub})`
          const parsedDescriptor = parseDescriptor(descriptorString)
          derivationPath = parsedDescriptor.derivationPath
        } catch {
          // Use default derivation path if extraction fails
          const rawDerivationPath = getDerivationPathFromScriptVersion(
            scriptVersion,
            builderNetwork
          )
          derivationPath = `m/${rawDerivationPath}`
        }
      }

      setExtendedPublicKey(convertedXpub)
      setFingerprint(localFingerprint || UNKNOWN_MASTER_FINGERPRINT)

      setKey(Number(keyIndex))

      setKeyDerivationPath(Number(keyIndex), derivationPath)

      clearKeyState()

      toast.success(t('account.import.success'))
      router.dismiss(1)
    } catch {
      toast.error(t('account.import.error.generic'))
    }
  }

  async function pasteFromClipboard() {
    try {
      const clipboardContent = await Clipboard.getStringAsync()
      if (!clipboardContent) {
        toast.error(t('watchonly.error.emptyClipboard'))
        return
      }

      const finalContent = clipboardContent.trim()
      updateXpub(finalContent)
      toast.success(t('watchonly.success.clipboardPasted'))
    } catch {
      toast.error(t('watchonly.error.clipboardPaste'))
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
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, '') // Remove control characters except \n
        .normalize('NFKC') // Normalize unicode characters
        .replace(/^en/, '')

      updateXpub(text)
      toast.success(t('watchonly.success.nfcRead'))
    } catch {
      toast.error(t('watchonly.error.nfcRead'))
    }
  }

  function handleContentScanned(content: DetectedContent) {
    if (
      scanningFor === 'fingerprint' ||
      content.type === 'master_fingerprint'
    ) {
      updateMasterFingerprint(content.cleaned)
      toast.success(t('watchonly.success.qrScanned'))
      return
    }
    if (
      content.type === 'extended_public_key' ||
      content.type === 'bitcoin_descriptor'
    ) {
      updateXpub(content.cleaned)
      toast.success(t('watchonly.success.qrScanned'))
    }
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('account.import.extendedPub')}</SSText>
          )
        }}
      />
      <SSScrollView>
        <SSVStack justifyBetween gap="lg" style={{ paddingBottom: 20 }}>
          <SSVStack gap="lg">
            <SSVStack gap="lg">
              <SSVStack gap="sm">
                <SSVStack gap="xxs">
                  <SSText center>{t('common.extendedPublicKey')}</SSText>
                  <SSText center color="muted" size="sm">
                    {t('account.import.xpubSteps')}
                  </SSText>
                  <SSTextInput
                    value={xpub}
                    style={validXpub ? styles.valid : styles.invalid}
                    onChangeText={updateXpub}
                    multiline
                  />
                  {xpubError && (
                    <SSText
                      style={{
                        color: Colors.error,
                        fontSize: 12,
                        marginTop: 4,
                        textAlign: 'center'
                      }}
                    >
                      {xpubError}
                    </SSText>
                  )}
                </SSVStack>
                <SSVStack gap="sm">
                  <SSHStack gap="sm">
                    <SSButton
                      label="Paste"
                      onPress={pasteFromClipboard}
                      style={{ flex: 1 }}
                      variant="subtle"
                    />
                    <SSButton
                      label="Scan QR"
                      onPress={() => {
                        setScanningFor('main')
                        setCameraModalVisible(true)
                      }}
                      style={{ flex: 1 }}
                      variant="subtle"
                    />
                  </SSHStack>
                  <Animated.View style={nfcButtonStyle}>
                    <SSButton
                      label={
                        isReading
                          ? t('watchonly.read.scanning')
                          : t('watchonly.read.nfc')
                      }
                      variant="subtle"
                      onPress={handleNFCRead}
                      disabled={!isHardwareSupported}
                    />
                  </Animated.View>
                </SSVStack>
              </SSVStack>
            </SSVStack>
            <SSVStack gap="lg">
              <SSVStack gap="sm">
                <SSText center>{t('common.fingerprint')}</SSText>
                <SSText center color="muted" size="sm">
                  {t('account.import.xpubFingerprintHelper')}
                </SSText>
                <SSTextInput
                  value={localFingerprint}
                  onChangeText={updateMasterFingerprint}
                  style={validMasterFingerprint ? styles.valid : styles.invalid}
                />

                <SSHStack gap="sm">
                  <SSButton
                    style={{ flex: 1 }}
                    label="Paste"
                    variant="subtle"
                    onPress={pasteFingerprintFromClipboard}
                  />
                  <SSButton
                    style={{ flex: 1 }}
                    label="Scan QR"
                    variant="subtle"
                    onPress={() => {
                      setScanningFor('fingerprint')
                      setCameraModalVisible(true)
                    }}
                  />
                </SSHStack>
              </SSVStack>
              <SSButton
                label={t('common.confirm')}
                variant="secondary"
                disabled={disabled}
                onPress={handleConfirm}
              />
              <SSButton
                label={t('common.cancel')}
                variant="ghost"
                onPress={() => router.dismiss(1)}
              />
            </SSVStack>
          </SSVStack>
        </SSVStack>
      </SSScrollView>
      <SSCameraModal
        visible={cameraModalVisible}
        onClose={() => {
          setCameraModalVisible(false)
          setScanningFor('main')
        }}
        onContentScanned={handleContentScanned}
        context="bitcoin"
      />
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
