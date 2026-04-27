import * as Clipboard from 'expo-clipboard'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions
} from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { encodeProofsAsToken } from '@/api/ecash'
import SSButton from '@/components/SSButton'
import SSNFCModal from '@/components/SSNFCModal'
import SSQRCode from '@/components/SSQRCode'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useEcash } from '@/hooks/useEcash'
import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { usePriceStore } from '@/store/price'
import { useSettingsStore } from '@/store/settings'
import { Colors, Sizes } from '@/styles'
import { formatFiatPrice } from '@/utils/format'

const ANIMATED_QR_CHUNK_SIZE = 200
const ANIMATED_QR_INTERVAL_MS = 500

function getTokenChunks(token: string): string[] {
  if (token.length <= ANIMATED_QR_CHUNK_SIZE) {
    return [token]
  }
  const chunks: string[] = []
  const totalChunks = Math.ceil(token.length / ANIMATED_QR_CHUNK_SIZE)
  for (let i = 0; i < totalChunks; i += 1) {
    const chunk = token.slice(
      i * ANIMATED_QR_CHUNK_SIZE,
      (i + 1) * ANIMATED_QR_CHUNK_SIZE
    )
    chunks.push(`${i + 1}/${totalChunks} ${chunk}`)
  }
  return chunks
}

export default function EcashProofDetailPage() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const { proofIndex } = useLocalSearchParams<{ proofIndex: string }>()
  const { proofs, mints, counters } = useEcash()
  const {
    isEmitting,
    isHardwareSupported: nfcHardwareSupported,
    emitNFCTag,
    cancelNFCScan
  } = useNFCEmitter()

  const [tokenVersion, setTokenVersion] = useState<'v3' | 'v4'>('v4')
  const [token, setToken] = useState<string | null>(null)
  const [animatedQR, setAnimatedQR] = useState(false)
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0)
  const [nfcModalVisible, setNfcModalVisible] = useState(false)
  const animationRef = useRef<number | null>(null)
  const lastUpdateRef = useRef(0)

  const [currencyUnit, privacyMode, useZeroPadding] = useSettingsStore(
    useShallow((state) => [
      state.currencyUnit,
      state.privacyMode,
      state.useZeroPadding
    ])
  )
  const [fiatCurrency, btcPrice] = usePriceStore(
    useShallow((state) => [state.fiatCurrency, state.btcPrice])
  )

  const qrSize = Math.floor(width * 0.88)
  const index = Number(proofIndex)
  const proof = proofs[index]

  const chunks = token ? getTokenChunks(token) : []
  const totalChunks = chunks.length
  const isMultiPart = totalChunks > 1

  useEffect(() => {
    if (!animatedQR || !isMultiPart) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      return
    }

    const animate = (timestamp: number) => {
      if (timestamp - lastUpdateRef.current >= ANIMATED_QR_INTERVAL_MS) {
        setCurrentChunkIndex((prev) => (prev + 1) % totalChunks)
        lastUpdateRef.current = timestamp
      }
      animationRef.current = requestAnimationFrame(animate)
    }
    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [animatedQR, isMultiPart, totalChunks])

  if (!proof) {
    return (
      <SSMainLayout>
        <Stack.Screen
          options={{
            headerTitle: () => (
              <SSText uppercase>{t('ecash.proofDetail.title')}</SSText>
            )
          }}
        />
        <SSVStack gap="md">
          <SSText color="muted">{t('ecash.transactionDetail.notFound')}</SSText>
          <SSButton
            label={t('common.goBack')}
            onPress={() => router.back()}
            variant="outline"
          />
        </SSVStack>
      </SSMainLayout>
    )
  }

  const allKeysets = mints.flatMap((mint) => mint.keysets)
  const keyset = allKeysets.find((ks) => ks.id === proof.id)
  const keysetCounters = counters
    ? Object.fromEntries(counters.map((c) => [c.keysetId, c.counter]))
    : undefined
  const counter = keysetCounters?.[proof.id]

  function handleCreateToken() {
    const encoded = encodeProofsAsToken(
      proof.mintUrl,
      [proof],
      undefined,
      tokenVersion
    )
    setToken(encoded)
    setCurrentChunkIndex(0)
    toast.success(t('ecash.proofDetail.tokenCreated'))
  }

  function handleVersionChange(version: 'v3' | 'v4') {
    setTokenVersion(version)
    if (token) {
      const encoded = encodeProofsAsToken(
        proof.mintUrl,
        [proof],
        undefined,
        version
      )
      setToken(encoded)
      setCurrentChunkIndex(0)
    }
  }

  function getQRValue(): string {
    if (chunks.length === 0) {
      return ''
    }
    if (!animatedQR || !isMultiPart) {
      return token ?? ''
    }
    return chunks[currentChunkIndex] ?? ''
  }

  async function handleCopyToken() {
    if (!token) {
      return
    }
    try {
      await Clipboard.setStringAsync(token)
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error(t('ecash.error.failedToCopy'))
    }
  }

  async function handleEmitNFC() {
    if (!token) {
      return
    }
    setNfcModalVisible(true)
    try {
      await emitNFCTag(token)
      toast.success(t('ecash.proofDetail.tokenCreated'))
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown'
      toast.error(`Failed to emit NFC: ${reason}`)
    } finally {
      setNfcModalVisible(false)
    }
  }

  function handleCloseNFCModal() {
    cancelNFCScan()
    setNfcModalVisible(false)
  }

  async function handleCopySecret() {
    try {
      await Clipboard.setStringAsync(proof.secret)
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error(t('ecash.error.failedToCopy'))
    }
  }

  async function handleCopyC() {
    try {
      await Clipboard.setStringAsync(proof.C)
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error(t('ecash.error.failedToCopy'))
    }
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('ecash.proofDetail.title')}</SSText>
          )
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="lg">
          <SSVStack gap="xs" style={styles.amountSection}>
            <SSText color="muted" size="xs" uppercase>
              {t('ecash.proofDetail.amount')}
            </SSText>
            <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
              {privacyMode ? (
                <SSText size="4xl" weight="ultralight">
                  ••••
                </SSText>
              ) : (
                <SSStyledSatText
                  amount={proof.amount}
                  decimals={0}
                  useZeroPadding={useZeroPadding}
                  currency={currencyUnit}
                  textSize="4xl"
                  weight="ultralight"
                  letterSpacing={-1}
                />
              )}
              <SSText size="xl" color="muted">
                {currencyUnit === 'btc' ? t('bitcoin.btc') : t('bitcoin.sats')}
              </SSText>
            </SSHStack>
            {btcPrice > 0 && (
              <SSHStack gap="xs" style={{ alignItems: 'baseline' }}>
                <SSText color="muted">
                  {privacyMode
                    ? '••••'
                    : formatFiatPrice(proof.amount, btcPrice)}
                </SSText>
                <SSText size="xs" style={{ color: Colors.gray[500] }}>
                  {fiatCurrency}
                </SSText>
              </SSHStack>
            )}
          </SSVStack>

          <SSVStack gap="sm">
            <SSVStack gap="none">
              <SSText color="muted" size="xs" uppercase>
                {t('ecash.proofs.keysetId')}
              </SSText>
              <SSHStack gap="xs" style={{ alignItems: 'center' }}>
                <SSText type="mono" size="xs">
                  {proof.id}
                </SSText>
                {keyset && (
                  <SSText
                    size="xs"
                    style={{
                      color: keyset.active ? Colors.success : Colors.gray[500]
                    }}
                  >
                    {keyset.active
                      ? t('ecash.proofs.active')
                      : t('ecash.proofs.inactive')}
                  </SSText>
                )}
              </SSHStack>
            </SSVStack>

            <SSVStack gap="none">
              <SSText color="muted" size="xs" uppercase>
                {t('ecash.proofs.secret')}
              </SSText>
              <SSText
                type="mono"
                size="xs"
                numberOfLines={2}
                onPress={handleCopySecret}
              >
                {privacyMode ? '••••••••••••••••' : proof.secret}
              </SSText>
            </SSVStack>

            <SSVStack gap="none">
              <SSText color="muted" size="xs" uppercase>
                {t('ecash.proofs.blindingFactor')}
              </SSText>
              <SSText
                type="mono"
                size="xs"
                numberOfLines={2}
                onPress={handleCopyC}
              >
                {privacyMode ? '••••••••••••••••' : proof.C}
              </SSText>
            </SSVStack>

            {proof.mintUrl && (
              <SSVStack gap="none">
                <SSText color="muted" size="xs" uppercase>
                  {t('ecash.proofs.mintUrl')}
                </SSText>
                <SSText type="mono" size="xs" numberOfLines={1}>
                  {proof.mintUrl}
                </SSText>
              </SSVStack>
            )}

            {counter !== undefined && (
              <SSVStack gap="none">
                <SSText color="muted" size="xs" uppercase>
                  {t('ecash.proofs.derivationCounter')}
                </SSText>
                <SSText type="mono" size="xs">
                  {counter}
                </SSText>
              </SSVStack>
            )}
          </SSVStack>

          <SSVStack gap="sm">
            {!token ? (
              <>
                <SSHStack gap="sm">
                  <Pressable
                    onPress={() => handleVersionChange('v4')}
                    style={[
                      styles.toggleTab,
                      tokenVersion === 'v4'
                        ? styles.toggleTabActive
                        : styles.toggleTabInactive
                    ]}
                  >
                    <SSText
                      center
                      uppercase
                      weight="medium"
                      style={{
                        color:
                          tokenVersion === 'v4' ? Colors.white : Colors.gray[50]
                      }}
                    >
                      {t('ecash.send.tokenV4')}
                    </SSText>
                  </Pressable>
                  <Pressable
                    onPress={() => handleVersionChange('v3')}
                    style={[
                      styles.toggleTab,
                      tokenVersion === 'v3'
                        ? styles.toggleTabActive
                        : styles.toggleTabInactive
                    ]}
                  >
                    <SSText
                      center
                      uppercase
                      weight="medium"
                      style={{
                        color:
                          tokenVersion === 'v3' ? Colors.white : Colors.gray[50]
                      }}
                    >
                      {t('ecash.send.tokenV3')}
                    </SSText>
                  </Pressable>
                </SSHStack>
                <SSButton
                  label={t('ecash.proofDetail.createToken')}
                  onPress={handleCreateToken}
                  variant="gradient"
                  gradientType="special"
                />
              </>
            ) : (
              <SSVStack gap="md">
                <SSHStack gap="sm">
                  <Pressable
                    onPress={() => handleVersionChange('v4')}
                    style={[
                      styles.toggleTab,
                      tokenVersion === 'v4'
                        ? styles.toggleTabActive
                        : styles.toggleTabInactive
                    ]}
                  >
                    <SSText
                      center
                      uppercase
                      weight="medium"
                      style={{
                        color:
                          tokenVersion === 'v4' ? Colors.white : Colors.gray[50]
                      }}
                    >
                      {t('ecash.send.tokenV4')}
                    </SSText>
                  </Pressable>
                  <Pressable
                    onPress={() => handleVersionChange('v3')}
                    style={[
                      styles.toggleTab,
                      tokenVersion === 'v3'
                        ? styles.toggleTabActive
                        : styles.toggleTabInactive
                    ]}
                  >
                    <SSText
                      center
                      uppercase
                      weight="medium"
                      style={{
                        color:
                          tokenVersion === 'v3' ? Colors.white : Colors.gray[50]
                      }}
                    >
                      {t('ecash.send.tokenV3')}
                    </SSText>
                  </Pressable>
                </SSHStack>
                <SSVStack gap="xs" itemsCenter>
                  <SSQRCode
                    value={getQRValue()}
                    size={qrSize}
                    ecl={animatedQR && isMultiPart ? 'L' : 'H'}
                  />
                  <SSText color="muted" size="xs" style={styles.chunkCounter}>
                    {animatedQR && isMultiPart
                      ? `${currentChunkIndex + 1} / ${totalChunks}`
                      : ''}
                  </SSText>
                  {isMultiPart && (
                    <SSHStack gap="sm">
                      <Pressable
                        onPress={() => setAnimatedQR(false)}
                        style={[
                          styles.toggleTab,
                          animatedQR
                            ? styles.toggleTabInactive
                            : styles.toggleTabActive
                        ]}
                      >
                        <SSText
                          center
                          uppercase
                          weight="medium"
                          style={{
                            color: animatedQR ? Colors.gray[50] : Colors.white
                          }}
                        >
                          {t('ecash.send.staticQR')}
                        </SSText>
                      </Pressable>
                      <Pressable
                        onPress={() => setAnimatedQR(true)}
                        style={[
                          styles.toggleTab,
                          animatedQR
                            ? styles.toggleTabActive
                            : styles.toggleTabInactive
                        ]}
                      >
                        <SSText
                          center
                          uppercase
                          weight="medium"
                          style={{
                            color: animatedQR ? Colors.white : Colors.gray[50]
                          }}
                        >
                          {t('ecash.send.animatedQR')}
                        </SSText>
                      </Pressable>
                    </SSHStack>
                  )}
                </SSVStack>
                <SSTextInput
                  value={token}
                  multiline
                  editable={false}
                  style={styles.tokenInput}
                />
                <SSHStack gap="sm">
                  <SSButton
                    label={t('common.copy')}
                    onPress={handleCopyToken}
                    variant="subtle"
                    style={{ flex: 1 }}
                  />
                  <SSButton
                    label={t('common.emitNFC')}
                    onPress={handleEmitNFC}
                    variant="subtle"
                    loading={isEmitting}
                    disabled={!nfcHardwareSupported}
                    style={{ flex: 1 }}
                  />
                </SSHStack>
              </SSVStack>
            )}
          </SSVStack>
        </SSVStack>
      </ScrollView>
      <SSNFCModal
        visible={nfcModalVisible}
        onClose={handleCloseNFCModal}
        onContentRead={() => undefined}
        mode="write"
        dataToWrite={token ?? ''}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  amountSection: {
    alignItems: 'center',
    paddingVertical: 12
  },
  chunkCounter: {
    height: 16
  },
  toggleTab: {
    alignItems: 'center',
    borderRadius: Sizes.button.borderRadius,
    flex: 1,
    height: Sizes.button.height,
    justifyContent: 'center'
  },
  toggleTabActive: {
    borderColor: Colors.gray[75],
    borderWidth: 1
  },
  toggleTabInactive: {
    backgroundColor: Colors.gray[800]
  },
  tokenInput: {
    fontFamily: 'monospace',
    fontSize: 12,
    height: 'auto',
    minHeight: 100,
    padding: 12,
    textAlignVertical: 'top'
  }
})
