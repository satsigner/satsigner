import { FlashList } from '@shopify/flash-list'
import { useState } from 'react'
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View
} from 'react-native'

import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSModal from '@/components/SSModal'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import {
  NOSTR_CONTACT_QR_CODE_SIZE,
  NOSTR_CONTACT_QR_CONTAINER_PADDING,
  NOSTR_CONTACT_QR_PAGER_DOT_SIZE
} from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type NostrContactQrSlide } from '@/types/models/Nostr'
import { buildContactQrSlides } from '@/utils/nostrContactProfile'

const QR_CONTAINER_SIZE =
  NOSTR_CONTACT_QR_CODE_SIZE + NOSTR_CONTACT_QR_CONTAINER_PADDING * 2

type SSContactProfileQrOverlayProps = {
  contactNprofile: string | null
  lud16?: string
  shareProfileName: string
  targetNpub?: string
  visible: boolean
  onClose: () => void
}

type ContactQrItemProps = {
  label: string
  value: string
}

function ContactQrPlaceholder({ label }: { label: string }) {
  return (
    <SSVStack gap="sm" itemsCenter style={styles.qrItem}>
      <SSText center uppercase color="muted" size="xs">
        {label}
      </SSText>
      <View style={[styles.qrContainer, styles.qrPlaceholder]}>
        <SSText center color="muted" uppercase>
          {t('common.comingSoon')}
        </SSText>
      </View>
    </SSVStack>
  )
}

function ContactQrItem({ label, value }: ContactQrItemProps) {
  const [inverted, setInverted] = useState(false)

  function handleToggleInvert() {
    setInverted((current) => !current)
  }

  const qrColor = inverted ? Colors.black : Colors.white
  const qrBackground = inverted ? Colors.white : Colors.black

  return (
    <SSVStack gap="sm" itemsCenter style={styles.qrItem}>
      <SSText center uppercase color="muted" size="xs">
        {label}
      </SSText>
      <Pressable
        accessibilityRole="button"
        onPress={handleToggleInvert}
        style={[
          styles.qrContainer,
          inverted ? styles.qrContainerInverted : null
        ]}
      >
        <SSQRCode
          backgroundColor={qrBackground}
          color={qrColor}
          ecl="H"
          size={NOSTR_CONTACT_QR_CODE_SIZE}
          value={value}
        />
      </Pressable>
      <SSClipboardCopy text={value}>
        <SSText
          center
          color="muted"
          ellipsizeMode="middle"
          numberOfLines={2}
          size="xxs"
          type="mono"
        >
          {value}
        </SSText>
      </SSClipboardCopy>
    </SSVStack>
  )
}

type ContactQrPagerSlideProps = {
  item: NostrContactQrSlide
  width: number
}

function ContactQrPagerSlide({ item, width }: ContactQrPagerSlideProps) {
  return (
    <View style={[styles.qrSlide, { width }]}>
      {item.kind === 'placeholder' ? (
        <ContactQrPlaceholder label={item.label} />
      ) : (
        <ContactQrItem label={item.label} value={item.value ?? ''} />
      )}
    </View>
  )
}

export default function SSContactProfileQrOverlay({
  contactNprofile,
  lud16,
  shareProfileName,
  targetNpub,
  visible,
  onClose
}: SSContactProfileQrOverlayProps) {
  const [pagerWidth, setPagerWidth] = useState(0)
  const [activeQrIndex, setActiveQrIndex] = useState(0)

  const qrSlides = buildContactQrSlides({
    contactNprofile,
    lud16,
    targetNpub
  })

  function handlePagerLayout(width: number) {
    setPagerWidth((current) => (current === width ? current : width))
  }

  function handlePagerScrollEnd(
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) {
    if (pagerWidth <= 0) {
      return
    }

    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pagerWidth)
    setActiveQrIndex(nextIndex)
  }

  return (
    <SSModal
      closeButtonVariant="ghost"
      fullOpacity
      label={t('common.close')}
      onClose={onClose}
      visible={visible}
    >
      <SSVStack gap="md" style={styles.qrOverlayContent}>
        <SSText center uppercase>
          {t('nostrIdentity.contact.qrTitleNamed', {
            name: shareProfileName
          })}
        </SSText>
        <View
          onLayout={(event) =>
            handlePagerLayout(event.nativeEvent.layout.width)
          }
          style={styles.qrPager}
        >
          {pagerWidth > 0 ? (
            <FlashList
              data={qrSlides}
              decelerationRate="fast"
              getItemType={(item) => item.kind}
              horizontal
              keyExtractor={(item) => item.key}
              onMomentumScrollEnd={handlePagerScrollEnd}
              pagingEnabled
              renderItem={({ item }) => (
                <ContactQrPagerSlide item={item} width={pagerWidth} />
              )}
              showsHorizontalScrollIndicator={false}
              style={styles.qrPagerList}
            />
          ) : null}
        </View>
        {qrSlides.length > 1 ? (
          <SSHStack gap="xs" style={styles.qrPagerDots}>
            {qrSlides.map((slide, index) => (
              <View
                key={slide.key}
                style={[
                  styles.qrPagerDot,
                  index === activeQrIndex ? styles.qrPagerDotActive : null
                ]}
              />
            ))}
          </SSHStack>
        ) : null}
      </SSVStack>
    </SSModal>
  )
}

const styles = StyleSheet.create({
  qrContainer: {
    alignItems: 'center',
    backgroundColor: Colors.black,
    padding: NOSTR_CONTACT_QR_CONTAINER_PADDING
  },
  qrContainerInverted: {
    backgroundColor: Colors.white
  },
  qrItem: {
    width: '100%'
  },
  qrOverlayContent: {
    flex: 1,
    paddingBottom: 8,
    width: '100%'
  },
  qrPager: {
    flex: 1,
    width: '100%'
  },
  qrPagerDot: {
    backgroundColor: Colors.gray[700],
    borderRadius: NOSTR_CONTACT_QR_PAGER_DOT_SIZE / 2,
    height: NOSTR_CONTACT_QR_PAGER_DOT_SIZE,
    width: NOSTR_CONTACT_QR_PAGER_DOT_SIZE
  },
  qrPagerDotActive: {
    backgroundColor: Colors.white
  },
  qrPagerDots: {
    justifyContent: 'center',
    paddingTop: 4,
    width: '100%'
  },
  qrPagerList: {
    flex: 1
  },
  qrPlaceholder: {
    height: QR_CONTAINER_SIZE,
    justifyContent: 'center',
    width: QR_CONTAINER_SIZE
  },
  qrSlide: {
    flex: 1,
    justifyContent: 'center'
  }
})
