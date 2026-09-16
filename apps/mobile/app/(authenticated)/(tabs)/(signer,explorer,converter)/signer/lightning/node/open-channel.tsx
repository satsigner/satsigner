import { useQuery } from '@tanstack/react-query'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { toast } from 'sonner-native'

import SSIconBackArrow from '@/components/icons/SSIconBackArrow'
import SSAmountInput from '@/components/SSAmountInput'
import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSCheckbox from '@/components/SSCheckbox'
import SSIconButton from '@/components/SSIconButton'
import SSNumberInput from '@/components/SSNumberInput'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import {
  HEADER_CHROME_EDGE_NUDGE,
  HEADER_CHROME_HIT_BOX,
  HEADER_CHROME_ICON_SIZE
} from '@/constants/headerChrome'
import {
  LND_OPEN_CHANNEL_DEFAULT_MIN_CONFS,
  LND_OPEN_CHANNEL_MAX_MIN_CONFS,
  LND_OPEN_CHANNEL_MAX_SAT_PER_VBYTE,
  LND_OPEN_CHANNEL_MIN_FUNDING_SAT
} from '@/constants/lightning'
import { useLND } from '@/hooks/useLND'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type DetectedContent } from '@/utils/contentDetector'
import { formatShortPubkey } from '@/utils/format'
import { getLndErrorMessage } from '@/utils/lndHttpError'
import {
  formatLndPeerUri,
  type LndOpenChannelFunding,
  type LndOpenChannelValidationReason,
  openChannelWithPeer,
  parseOptionalSatPerVbyte,
  peerUriFromScannedText,
  validateLndOpenChannelInput
} from '@/utils/lndOpenChannel'

const OPEN_CHANNEL_PEER_LIST_MAX = 16

type OpenChannelPeerChipProps = {
  label: string
  onSelect: (uri: string) => void
  uri: string
}

function OpenChannelPeerChip({
  label,
  onSelect,
  uri
}: OpenChannelPeerChipProps) {
  function handlePress() {
    onSelect(uri)
  }

  return <SSButton label={label} onPress={handlePress} variant="subtle" />
}

type OpenChannelReviewRowProps = {
  children: React.ReactNode
  label: string
}

function OpenChannelReviewRow({ children, label }: OpenChannelReviewRowProps) {
  return (
    <SSVStack gap="xs">
      <SSText color="muted" size="sm">
        {label}
      </SSText>
      {children}
    </SSVStack>
  )
}

function validationErrorMessage(
  reason: LndOpenChannelValidationReason
): string {
  if (reason === 'amount') {
    return t('lightning.openChannel.invalidAmount')
  }
  if (reason === 'balance') {
    return t('lightning.openChannel.invalidBalance')
  }
  if (reason === 'fee') {
    return t('lightning.openChannel.invalidFee')
  }
  if (reason === 'minConfs') {
    return t('lightning.openChannel.invalidMinConfs')
  }
  if (reason === 'push') {
    return t('lightning.openChannel.invalidPush')
  }
  return t('lightning.openChannel.invalidPeer')
}

function readPubkeyParam(pubkey: string | string[] | undefined): string {
  if (typeof pubkey === 'string') {
    return pubkey
  }
  return ''
}

export default function OpenChannelPage() {
  const { back } = useRouter()
  const params = useLocalSearchParams<{ pubkey?: string }>()
  const {
    config,
    connectPeer,
    getBalance,
    getChannels,
    getPeers,
    getPendingChannels,
    isConnected,
    openChannel
  } = useLND()

  const [step, setStep] = useState<'form' | 'review'>('form')
  const [peerText, setPeerText] = useState(() => readPubkeyParam(params.pubkey))
  const [localFundingSat, setLocalFundingSat] = useState(
    LND_OPEN_CHANNEL_MIN_FUNDING_SAT
  )
  const [pushSat, setPushSat] = useState(0)
  const [privateChannel, setPrivateChannel] = useState(false)
  const [satPerVbyteText, setSatPerVbyteText] = useState('')
  const [minConfsText, setMinConfsText] = useState(
    String(LND_OPEN_CHANNEL_DEFAULT_MIN_CONFS)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)

  const balanceQuery = useQuery({
    enabled: Boolean(config) && isConnected,
    queryFn: getBalance,
    queryKey: ['lnd', 'open-channel-balance', config?.url]
  })
  const peersQuery = useQuery({
    enabled: Boolean(config) && isConnected,
    queryFn: getPeers,
    queryKey: ['lnd', 'open-channel-peers', config?.url]
  })

  const confirmedSat = Number(balanceQuery.data?.confirmed_balance ?? 0)
  const amountMax = Math.max(confirmedSat, LND_OPEN_CHANNEL_MIN_FUNDING_SAT)
  const peerList = peersQuery.data?.peers ?? []
  const peerChips: { label: string; uri: string }[] = []
  for (const peer of peerList) {
    if (peerChips.length >= OPEN_CHANNEL_PEER_LIST_MAX) {
      break
    }
    const uri = formatLndPeerUri(peer)
    if (!uri) {
      continue
    }
    peerChips.push({
      label: formatShortPubkey(peer.pub_key ?? uri),
      uri
    })
  }

  function handleBack() {
    if (step === 'review') {
      setStep('form')
      return
    }
    back()
  }

  function handlePeerChange(text: string) {
    setPeerText(text)
  }

  function handlePeerSelect(uri: string) {
    setPeerText(uri)
  }

  function handleOpenCamera() {
    setCameraModalVisible(true)
  }

  function handleCloseCamera() {
    setCameraModalVisible(false)
  }

  function handlePeerScanned(content: DetectedContent) {
    const uri =
      peerUriFromScannedText(content.cleaned) ??
      peerUriFromScannedText(content.raw)
    if (!uri) {
      toast.error(t('lightning.openChannel.invalidQr'))
      return
    }
    setPeerText(uri)
    setCameraModalVisible(false)
  }

  function handleLocalAmountChange(value: number) {
    setLocalFundingSat(value)
  }

  function handlePushChange(text: string) {
    if (!text) {
      setPushSat(0)
      return
    }
    setPushSat(Number(text))
  }

  function handlePrivatePress(currentlySelected: boolean) {
    setPrivateChannel(!currentlySelected)
  }

  function handleFeeChange(text: string) {
    setSatPerVbyteText(text)
  }

  function handleMinConfsChange(text: string) {
    setMinConfsText(text)
  }

  function buildFunding(): LndOpenChannelFunding {
    return {
      localFundingSat,
      minConfs: Number(minConfsText),
      privateChannel,
      pushSat,
      satPerVbyte: parseOptionalSatPerVbyte(satPerVbyteText)
    }
  }

  function handleContinue() {
    const validation = validateLndOpenChannelInput({
      confirmedSat,
      localFundingSat,
      minConfs: Number(minConfsText),
      peerText,
      pushSat,
      satPerVbyteText
    })
    if (!validation.ok) {
      toast.error(validationErrorMessage(validation.reason))
      return
    }
    setStep('review')
  }

  async function handleConfirm() {
    if (isSubmitting) {
      return
    }
    const validation = validateLndOpenChannelInput({
      confirmedSat,
      localFundingSat,
      minConfs: Number(minConfsText),
      peerText,
      pushSat,
      satPerVbyteText
    })
    if (!validation.ok) {
      toast.error(validationErrorMessage(validation.reason))
      setStep('form')
      return
    }
    setIsSubmitting(true)
    try {
      await openChannelWithPeer(validation.peer, buildFunding(), {
        connectPeer,
        openChannel
      })
      await Promise.allSettled([getChannels(), getPendingChannels()])
      toast.success(t('lightning.openChannel.success'))
      back()
    } catch (error) {
      toast.error(
        `${t('lightning.openChannel.failed')}: ${getLndErrorMessage(error)}`
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const title =
    step === 'review'
      ? t('lightning.openChannel.reviewTitle')
      : t('lightning.openChannel.title')
  const feeLabel =
    satPerVbyteText.trim() || t('lightning.openChannel.feeDefault')
  const privateLabel = privateChannel
    ? t('lightning.openChannel.privateYes')
    : t('lightning.openChannel.privateNo')

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <SSIconButton
              style={[
                HEADER_CHROME_HIT_BOX,
                { marginLeft: -HEADER_CHROME_EDGE_NUDGE }
              ]}
              onPress={handleBack}
            >
              <SSIconBackArrow
                height={HEADER_CHROME_ICON_SIZE}
                stroke={Colors.gray[200]}
                width={HEADER_CHROME_ICON_SIZE}
              />
            </SSIconButton>
          ),
          headerTitle: () => (
            <SSText uppercase style={{ letterSpacing: 1 }}>
              {title}
            </SSText>
          )
        }}
      />
      <SSMainLayout>
        {step === 'form' ? (
          <SSVStack gap="lg" justifyBetween>
            <SSScrollView>
              <SSVStack gap="lg">
                <SSFormLayout>
                  <SSFormLayout.Item>
                    <SSFormLayout.Label
                      center={false}
                      label={t('lightning.openChannel.peer')}
                    />
                    <SSTextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      onChangeText={handlePeerChange}
                      placeholder={t('lightning.openChannel.peerPlaceholder')}
                      value={peerText}
                      variant="outline"
                    />
                    <SSButton
                      label={t('lightning.openChannel.scanQr')}
                      onPress={handleOpenCamera}
                      variant="subtle"
                    />
                  </SSFormLayout.Item>
                  {peerChips.length > 0 ? (
                    <SSFormLayout.Item>
                      <SSFormLayout.Label
                        center={false}
                        label={t('lightning.openChannel.peersTitle')}
                      />
                      <SSVStack gap="sm">
                        {peerChips.map((peer) => (
                          <OpenChannelPeerChip
                            key={peer.uri}
                            label={peer.label}
                            onSelect={handlePeerSelect}
                            uri={peer.uri}
                          />
                        ))}
                      </SSVStack>
                    </SSFormLayout.Item>
                  ) : null}
                  <SSFormLayout.Item>
                    <SSFormLayout.Label
                      center={false}
                      label={t('lightning.openChannel.confirmedBalance')}
                    />
                    <SSStyledSatText
                      amount={confirmedSat}
                      noColor
                      showSign={false}
                      textSize="xl"
                    />
                  </SSFormLayout.Item>
                  <SSFormLayout.Item>
                    <SSAmountInput
                      max={amountMax}
                      min={LND_OPEN_CHANNEL_MIN_FUNDING_SAT}
                      onValueChange={handleLocalAmountChange}
                      remainingSats={confirmedSat}
                      value={localFundingSat}
                    />
                  </SSFormLayout.Item>
                  <SSFormLayout.Item>
                    <SSFormLayout.Label
                      center={false}
                      label={t('lightning.openChannel.push')}
                    />
                    <SSNumberInput
                      allowValidEmpty
                      max={localFundingSat}
                      min={0}
                      onChangeText={handlePushChange}
                      value={String(pushSat)}
                    />
                  </SSFormLayout.Item>
                  <SSCheckbox
                    label={t('lightning.openChannel.private')}
                    onPress={handlePrivatePress}
                    selected={privateChannel}
                  />
                  <SSFormLayout.Item>
                    <SSFormLayout.Label
                      center={false}
                      label={t('lightning.openChannel.feeRate')}
                    />
                    <SSNumberInput
                      allowValidEmpty
                      max={LND_OPEN_CHANNEL_MAX_SAT_PER_VBYTE}
                      min={1}
                      onChangeText={handleFeeChange}
                      value={satPerVbyteText}
                    />
                  </SSFormLayout.Item>
                  <SSFormLayout.Item>
                    <SSFormLayout.Label
                      center={false}
                      label={t('lightning.openChannel.minConfs')}
                    />
                    <SSNumberInput
                      max={LND_OPEN_CHANNEL_MAX_MIN_CONFS}
                      min={0}
                      onChangeText={handleMinConfsChange}
                      value={minConfsText}
                    />
                  </SSFormLayout.Item>
                </SSFormLayout>
              </SSVStack>
            </SSScrollView>
            <SSButton label={t('common.continue')} onPress={handleContinue} />
          </SSVStack>
        ) : (
          <SSVStack gap="lg" justifyBetween>
            <SSScrollView>
              <SSVStack gap="md">
                <OpenChannelReviewRow label={t('lightning.openChannel.peer')}>
                  <SSText
                    ellipsizeMode="middle"
                    numberOfLines={2}
                    size="sm"
                    type="mono"
                  >
                    {peerText}
                  </SSText>
                </OpenChannelReviewRow>
                <OpenChannelReviewRow
                  label={t('lightning.openChannel.localAmount')}
                >
                  <SSStyledSatText
                    amount={localFundingSat}
                    noColor={false}
                    showSign={false}
                    textSize="xl"
                    type="send"
                  />
                </OpenChannelReviewRow>
                <OpenChannelReviewRow label={t('lightning.openChannel.push')}>
                  <SSStyledSatText
                    amount={pushSat}
                    noColor
                    showSign={false}
                    textSize="lg"
                  />
                </OpenChannelReviewRow>
                <OpenChannelReviewRow
                  label={t('lightning.openChannel.private')}
                >
                  <SSText>{privateLabel}</SSText>
                </OpenChannelReviewRow>
                <OpenChannelReviewRow
                  label={t('lightning.openChannel.feeRate')}
                >
                  <SSText type="mono">{feeLabel}</SSText>
                </OpenChannelReviewRow>
                <OpenChannelReviewRow
                  label={t('lightning.openChannel.minConfs')}
                >
                  <SSText type="mono">{minConfsText}</SSText>
                </OpenChannelReviewRow>
              </SSVStack>
            </SSScrollView>
            <SSVStack gap="sm">
              <SSButton
                label={
                  isSubmitting
                    ? t('lightning.openChannel.opening')
                    : t('lightning.openChannel.confirm')
                }
                loading={isSubmitting}
                onPress={handleConfirm}
                variant="gradient"
              />
              <SSButton
                label={t('lightning.openChannel.backToForm')}
                onPress={handleBack}
                variant="ghost"
              />
            </SSVStack>
          </SSVStack>
        )}
      </SSMainLayout>
      <SSCameraModal
        context="lightning"
        onClose={handleCloseCamera}
        onContentScanned={handlePeerScanned}
        title={t('lightning.openChannel.scanModalTitle')}
        visible={cameraModalVisible}
      />
    </>
  )
}
