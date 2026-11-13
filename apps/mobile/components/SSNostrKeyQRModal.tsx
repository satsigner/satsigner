import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import {
  NOSTR_KEY_LINE_BREAK_EVERY,
  NOSTR_KEY_QR_SIZE
} from '@/constants/nostr'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type DetectedContent } from '@/utils/contentDetector'
import {
  formatNostrKey,
  getNip19Type,
  getNostrKeyLabel,
  type NostrKeyFormat
} from '@/utils/nostr'
import { nostrScannedContentHref } from '@/utils/nostrNavigation'

import SSCameraModal from './SSCameraModal'
import SSModal from './SSModal'
import SSPairedTabs from './SSPairedTabs'
import SSShadedKeyText from './SSShadedKeyText'
import SSShareableQR from './SSShareableQR'
import SSText from './SSText'

type KeyQrFormat = NostrKeyFormat | 'lnaddress'

type KeyQr = {
  format: KeyQrFormat
  label: string
  value: string
}

type KeyQrSource = {
  hexValue: string | null
  key: string
  keyLabel: string
  lnAddress: string
}

type SSNostrKeyQRModalProps = {
  value: string
  label: string
  shareable: boolean
  visible: boolean
  onClose: () => void
  lnAddress?: string
  ownerNpub?: string
}

function resolveKeyQr(requested: KeyQrFormat, source: KeyQrSource): KeyQr {
  if (requested === 'hex' && source.hexValue) {
    const keyType = getNip19Type(source.key) === 'nsec' ? 'nsec' : 'npub'
    return {
      format: 'hex',
      label: getNostrKeyLabel(keyType, 'hex'),
      value: source.hexValue
    }
  }
  if (requested === 'lnaddress' && source.lnAddress) {
    return {
      format: 'lnaddress',
      label: t('nostrIdentity.keys.lnaddress'),
      value: source.lnAddress
    }
  }
  return { format: 'bech32', label: source.keyLabel, value: source.key }
}

function SSNostrKeyQRModal({
  value,
  label,
  shareable,
  visible,
  onClose,
  lnAddress,
  ownerNpub
}: SSNostrKeyQRModalProps) {
  const router = useRouter()
  const [format, setFormat] = useState<KeyQrFormat>('bech32')
  const [cameraVisible, setCameraVisible] = useState(false)

  const trimmedLnAddress = lnAddress?.trim() ?? ''
  const hexValue = formatNostrKey(value, 'hex')
  const keyQr = resolveKeyQr(format, {
    hexValue,
    key: value,
    keyLabel: label,
    lnAddress: trimmedLnAddress
  })
  const showFormatTabs = Boolean(hexValue) || Boolean(trimmedLnAddress)
  const canScan = Boolean(ownerNpub)

  function handleFormatChange(next: KeyQrFormat) {
    setFormat(next)
  }

  function handleClose() {
    setFormat('bech32')
    setCameraVisible(false)
    onClose()
  }

  function handleOpenCamera() {
    setCameraVisible(true)
  }

  function handleCloseCamera() {
    setCameraVisible(false)
  }

  function handleContentScanned(detected: DetectedContent) {
    if (!ownerNpub) {
      return
    }
    setCameraVisible(false)
    const href = nostrScannedContentHref(ownerNpub, detected)
    if (!href) {
      toast.error(t('nostrIdentity.note.invalidContent'))
      return
    }
    handleClose()
    router.navigate(href)
  }

  return (
    <>
      <SSModal
        visible={visible && !cameraVisible}
        fullOpacity
        onClose={handleClose}
        label={t('common.cancel')}
        confirmLabel={t('common.scan')}
        onConfirm={canScan ? handleOpenCamera : undefined}
      >
        <SSVStack gap="lg" style={styles.content}>
          <SSText center uppercase>
            {keyQr.label}
          </SSText>
          {showFormatTabs ? (
            <SSPairedTabs
              activeTab={keyQr.format}
              primary={{
                key: 'bech32',
                label: t('nostrIdentity.keys.format.bech32')
              }}
              secondary={{
                key: 'hex',
                label: t('nostrIdentity.keys.format.hex')
              }}
              tertiary={
                trimmedLnAddress
                  ? {
                      key: 'lnaddress',
                      label: t('nostrIdentity.keys.lnaddress')
                    }
                  : undefined
              }
              onChange={handleFormatChange}
            />
          ) : null}
          <SSShareableQR
            value={keyQr.value}
            size={NOSTR_KEY_QR_SIZE}
            color={Colors.white}
            backgroundColor={Colors.gray[950]}
            ecl="H"
            containerStyle={styles.qrCodeWrapper}
            hideShareButton={!shareable}
          >
            <View style={styles.dataBox}>
              <SSShadedKeyText
                value={keyQr.value}
                size="sm"
                lineBreakEvery={NOSTR_KEY_LINE_BREAK_EVERY}
              />
            </View>
          </SSShareableQR>
        </SSVStack>
      </SSModal>
      {canScan ? (
        <SSCameraModal
          context="nostr"
          visible={visible && cameraVisible}
          onClose={handleCloseCamera}
          onContentScanned={handleContentScanned}
        />
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    paddingHorizontal: 16
  },
  dataBox: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    maxWidth: '100%',
    padding: 12
  },
  qrCodeWrapper: {
    backgroundColor: Colors.gray[950],
    borderRadius: 10,
    padding: 16
  }
})

export default SSNostrKeyQRModal
