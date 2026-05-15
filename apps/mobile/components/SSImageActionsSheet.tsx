import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
import { useState } from 'react'
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native'
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView
} from 'react-native-gesture-handler'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import {
  type SelectedImageMeta,
  useImageActionsStore
} from '@/store/imageActions'
import { Colors, Layout } from '@/styles'
import { setClipboard } from '@/utils/clipboard'
import { type ImageExifData } from '@/utils/imageExif'

const DISMISS_DRAG_THRESHOLD = 80
const DISMISS_VELOCITY_Y = 500

async function saveImage(uri: string): Promise<void> {
  const filename = uri.split('/').pop()?.split('?')[0] ?? 'image'
  const localUri = `${FileSystem.cacheDirectory}${filename}`
  await FileSystem.downloadAsync(uri, localUri)
  await Sharing.shareAsync(localUri)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatExposure(seconds: number): string {
  if (seconds >= 1) {
    return `${seconds}s`
  }
  return `1/${Math.round(1 / seconds)}s`
}

function formatGps(lat: number, lon: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lonDir = lon >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lon).toFixed(6)}° ${lonDir}`
}

type MetaRowProps = { label: string; value: string }

function MetaRow({ label, value }: MetaRowProps) {
  return (
    <SSVStack gap="xxs">
      <SSText size="xs" color="muted" uppercase>
        {label}
      </SSText>
      <SSText size="xs" type="mono" style={styles.metaValue}>
        {value}
      </SSText>
    </SSVStack>
  )
}

function HttpMetaSection({ image }: { image: SelectedImageMeta }) {
  return (
    <>
      <MetaRow
        label={t('nostrIdentity.note.imageMetadataUrl')}
        value={image.uri}
      />
      {image.filename ? (
        <MetaRow
          label={t('nostrIdentity.note.imageMetadataFilename')}
          value={image.filename}
        />
      ) : null}
      {image.width > 0 ? (
        <MetaRow
          label={t('nostrIdentity.note.imageMetadataDimensions')}
          value={`${image.width} × ${image.height} px`}
        />
      ) : null}
      {image.fileSize !== undefined ? (
        <MetaRow
          label={t('nostrIdentity.note.imageMetadataFileSize')}
          value={formatBytes(image.fileSize)}
        />
      ) : null}
      {image.contentType ? (
        <MetaRow
          label={t('nostrIdentity.note.imageMetadataContentType')}
          value={image.contentType}
        />
      ) : null}
    </>
  )
}

function ExifMetaSection({ exif }: { exif: ImageExifData }) {
  const cameraLine = [exif.make, exif.model].filter(Boolean).join(' ')
  const hasCapture =
    exif.exposureTime !== undefined ||
    exif.fNumber !== undefined ||
    exif.iso !== undefined ||
    exif.focalLength !== undefined

  return (
    <>
      {exif.description ? (
        <MetaRow
          label={t('nostrIdentity.note.imageMetadataDescription')}
          value={exif.description}
        />
      ) : null}
      {exif.headline ? (
        <MetaRow
          label={t('nostrIdentity.note.imageMetadataHeadline')}
          value={exif.headline}
        />
      ) : null}
      {exif.artist ? (
        <MetaRow
          label={t('nostrIdentity.note.imageMetadataArtist')}
          value={exif.artist}
        />
      ) : null}
      {exif.byline && exif.byline !== exif.artist ? (
        <MetaRow
          label={t('nostrIdentity.note.imageMetadataArtist')}
          value={exif.byline}
        />
      ) : null}
      {exif.copyright ? (
        <MetaRow
          label={t('nostrIdentity.note.imageMetadataCopyright')}
          value={exif.copyright}
        />
      ) : null}
      {exif.city || exif.country ? (
        <MetaRow
          label={
            exif.city && exif.country
              ? `${t('nostrIdentity.note.imageMetadataCity')} / ${t('nostrIdentity.note.imageMetadataCountry')}`
              : exif.city
                ? t('nostrIdentity.note.imageMetadataCity')
                : t('nostrIdentity.note.imageMetadataCountry')
          }
          value={[exif.city, exif.country].filter(Boolean).join(', ')}
        />
      ) : null}
      {exif.keywords && exif.keywords.length > 0 ? (
        <MetaRow
          label={t('nostrIdentity.note.imageMetadataKeywords')}
          value={exif.keywords.join(', ')}
        />
      ) : null}
      {exif.dateTimeOriginal ? (
        <MetaRow
          label={t('nostrIdentity.note.imageMetadataDateTime')}
          value={exif.dateTimeOriginal.toLocaleString()}
        />
      ) : null}
      {cameraLine ? (
        <MetaRow
          label={`${t('nostrIdentity.note.imageMetadataMake')} / ${t('nostrIdentity.note.imageMetadataModel')}`}
          value={cameraLine}
        />
      ) : null}
      {exif.lens ? (
        <MetaRow
          label={t('nostrIdentity.note.imageMetadataLens')}
          value={exif.lens}
        />
      ) : null}
      {hasCapture ? (
        <MetaRow
          label={t('nostrIdentity.note.imageMetadataExposure')}
          value={[
            exif.exposureTime !== undefined
              ? formatExposure(exif.exposureTime)
              : null,
            exif.fNumber !== undefined ? `f/${exif.fNumber}` : null,
            exif.iso !== undefined ? `ISO ${exif.iso}` : null,
            exif.focalLength !== undefined ? `${exif.focalLength}mm` : null
          ]
            .filter(Boolean)
            .join('  ·  ')}
        />
      ) : null}
      {exif.latitude !== undefined && exif.longitude !== undefined ? (
        <MetaRow
          label={t('nostrIdentity.note.imageMetadataGPS')}
          value={formatGps(exif.latitude, exif.longitude)}
        />
      ) : null}
      {exif.altitude !== undefined ? (
        <MetaRow
          label={t('nostrIdentity.note.imageMetadataAltitude')}
          value={`${exif.altitude.toFixed(1)} m`}
        />
      ) : null}
      {exif.software ? (
        <MetaRow
          label={t('nostrIdentity.note.imageMetadataSoftware')}
          value={exif.software}
        />
      ) : null}
    </>
  )
}

export default function SSImageActionsSheet() {
  const [showMeta, setShowMeta] = useState(false)
  const { height: windowHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const translateY = useSharedValue(windowHeight)

  const selectedImage = useImageActionsStore((s) => s.selectedImage)
  const clearSelectedImage = useImageActionsStore((s) => s.clearSelectedImage)

  function handleDismiss() {
    setShowMeta(false)
    clearSelectedImage()
  }

  function dismissWithAnimation() {
    translateY.value = withTiming(
      windowHeight,
      { duration: 220 },
      (finished) => {
        if (finished) {
          runOnJS(handleDismiss)()
        }
      }
    )
  }

  const pan = Gesture.Pan()
    .maxPointers(1)
    .minDistance(0)
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY)
    })
    .onEnd((e) => {
      const shouldDismiss =
        translateY.value > DISMISS_DRAG_THRESHOLD ||
        e.velocityY > DISMISS_VELOCITY_Y
      translateY.value = shouldDismiss
        ? withTiming(windowHeight, { duration: 220 }, (finished) => {
            if (finished) {
              runOnJS(handleDismiss)()
            }
          })
        : withTiming(0, { duration: 200 })
    })

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }]
  }))

  function handleCopyUrl() {
    if (!selectedImage) {
      return
    }
    void setClipboard(selectedImage.uri)
    dismissWithAnimation()
  }

  async function handleSaveImage() {
    if (!selectedImage) {
      return
    }
    const { uri } = selectedImage
    dismissWithAnimation()
    try {
      await saveImage(uri)
    } catch {
      // sharing cancelled or unavailable — silently ignored
    }
  }

  const hasExif =
    selectedImage?.exif !== undefined && selectedImage.exif !== null

  return (
    <Modal
      visible={selectedImage !== null}
      transparent
      animationType="none"
      onRequestClose={dismissWithAnimation}
      onShow={() => {
        translateY.value = withTiming(0, { duration: 280 })
      }}
      statusBarTranslucent
    >
      <>
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={dismissWithAnimation}
        />
        <GestureHandlerRootView style={styles.gestureRoot}>
          <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
            <GestureDetector gesture={pan}>
              <View style={styles.handleArea}>
                <View style={styles.handle} />
                <SSText uppercase center style={styles.title}>
                  {showMeta
                    ? t('nostrIdentity.note.imageMetadataTitle')
                    : t('nostrIdentity.note.imageActions')}
                </SSText>
              </View>
            </GestureDetector>
            {showMeta && selectedImage ? (
              <ScrollView
                style={[styles.metaScroll, { maxHeight: windowHeight * 0.72 }]}
                contentContainerStyle={{
                  paddingBottom: insets.bottom + 24
                }}
                showsVerticalScrollIndicator={false}
              >
                <SSVStack gap="md">
                  <HttpMetaSection image={selectedImage} />
                  {hasExif ? (
                    <ExifMetaSection exif={selectedImage.exif!} />
                  ) : selectedImage.exif === null ? (
                    <SSText size="xs" color="muted" center>
                      {t('nostrIdentity.note.imageMetadataNoExif')}
                    </SSText>
                  ) : null}
                  <SSButton
                    label={t('common.back')}
                    variant="ghost"
                    onPress={() => setShowMeta(false)}
                  />
                </SSVStack>
              </ScrollView>
            ) : (
              <SSVStack
                gap="sm"
                style={[styles.actions, { paddingBottom: insets.bottom + 8 }]}
              >
                <SSButton
                  label={t('nostrIdentity.note.imageCopyUrl')}
                  variant="subtle"
                  onPress={handleCopyUrl}
                />
                <SSButton
                  label={t('nostrIdentity.note.imageSave')}
                  variant="subtle"
                  onPress={() => void handleSaveImage()}
                />
                <SSButton
                  label={t('nostrIdentity.note.imageViewMetadata')}
                  variant="subtle"
                  onPress={() => setShowMeta(true)}
                />
                <SSButton
                  label={t('common.cancel')}
                  variant="ghost"
                  onPress={dismissWithAnimation}
                />
              </SSVStack>
            )}
          </Animated.View>
        </GestureHandlerRootView>
      </>
    </Modal>
  )
}

const styles = StyleSheet.create({
  actions: {},
  gestureRoot: {},
  handle: {
    alignSelf: 'center',
    backgroundColor: Colors.gray[700],
    borderRadius: 2,
    height: 4,
    marginBottom: 12,
    width: 40
  },
  handleArea: {
    paddingTop: 4
  },
  metaScroll: {},
  metaValue: {
    color: Colors.white,
    flexWrap: 'wrap'
  },
  overlay: {
    flex: 1
  },
  sheet: {
    backgroundColor: Colors.gray[950],
    borderColor: Colors.gray[500],
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderTopWidth: 1,
    paddingHorizontal: Layout.mainContainer.paddingHorizontal,
    paddingTop: 16
  },
  title: {
    marginBottom: 16
  }
})
