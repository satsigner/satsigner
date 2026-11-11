import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  NOSTR_KEY_LINE_BREAK_EVERY,
  NOSTR_KEY_QR_SIZE
} from '@/constants/nostr'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type DetectedContent } from '@/utils/contentDetector'
import { formatNostrKey, getNip19Type } from '@/utils/nostr'
import { nostrBunkerConnectHref, nostrNoteHref } from '@/utils/nostrNavigation'

import SSCameraModal from './SSCameraModal'
import SSModal from './SSModal'
import SSPairedTabs from './SSPairedTabs'
import SSShadedKeyText from './SSShadedKeyText'
import SSShareableQR from './SSShareableQR'
import SSText from './SSText'

type KeyQrFormat = 'bech32' | 'hex' | 'lnaddress'

type SSNostrKeyQRModalProps = {
  value: string
  label: string
  shareable: boolean
  visible: boolean
  onClose: () => void
  lnAddress?: string
  ownerNpub?: string
}

function resolveFormat(
  format: KeyQrFormat,
  hexValue: string | null,
  lnAddress: string
): KeyQrFormat {
  if (format === 'hex' && hexValue) {
    return 'hex'
  }
  if (format === 'lnaddress' && lnAddress) {
    return 'lnaddress'
  }
  return 'bech32'
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
  const isSecret = getNip19Type(value) === 'nsec'
  const hexValue = formatNostrKey(value, 'hex')
  const activeFormat = resolveFormat(format, hexValue, trimmedLnAddress)
  const qrValue =
    activeFormat === 'hex'
      ? (hexValue ?? value)
      : activeFormat === 'lnaddress'
        ? trimmedLnAddress
        : value
  const qrLabel =
    activeFormat === 'hex'
      ? t(
          isSecret ? 'nostrIdentity.keys.nsecHex' : 'nostrIdentity.keys.npubHex'
        )
      : activeFormat === 'lnaddress'
        ? t('nostrIdentity.keys.lnaddress')
        : label
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
    setFormat('bech32')
    onClose()
    if (detected.type === 'nostr_connect') {
      router.navigate(
        nostrBunkerConnectHref(ownerNpub, detected.cleaned || detected.raw)
      )
      return
    }
    router.navigate(nostrNoteHref(ownerNpub, detected.cleaned || detected.raw))
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
            {qrLabel}
          </SSText>
          {showFormatTabs ? (
            <SSPairedTabs
              activeTab={activeFormat}
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
            value={qrValue}
            size={NOSTR_KEY_QR_SIZE}
            color={Colors.white}
            backgroundColor={Colors.gray[950]}
            ecl="H"
            containerStyle={styles.qrCodeWrapper}
            hideShareButton={!shareable}
          >
            <View style={styles.dataBox}>
              <SSShadedKeyText
                value={qrValue}
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
