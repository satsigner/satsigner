import { Image, type ImageStyle } from 'expo-image'
import { useId, useSyncExternalStore } from 'react'
import { type StyleProp, StyleSheet, View } from 'react-native'

import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import {
  brantaLogoPromptRef,
  getBrantaLogoConsent,
  setBrantaLogoSession,
  subscribeBrantaLogoConsent
} from '@/utils/brantaLogoConsent'
import { brantaLogoUrl, brantaRequestsBlocked } from '@/utils/brantaUrl'

import SSButton from './SSButton'
import SSModal from './SSModal'
import SSText from './SSText'

type SSBrantaLogoProps = {
  style: StyleProp<ImageStyle>
  uri: string | undefined
}

function allowLogosOnce() {
  setBrantaLogoSession('allow')
}

function denyLogos() {
  setBrantaLogoSession('deny')
}

function allowLogosAlways() {
  useSettingsStore.getState().setBrantaClearnetLogoAllowed(true)
  setBrantaLogoSession('allow')
}

function SSBrantaLogo({ style, uri }: SSBrantaLogoProps) {
  const ownerId = useId()
  const requestsBlocked = useSettingsStore(brantaRequestsBlocked)
  const allowedAlways = useSettingsStore(
    (state) => state.brantaClearnetLogoAllowed
  )
  const consent = useSyncExternalStore(
    subscribeBrantaLogoConsent,
    getBrantaLogoConsent,
    getBrantaLogoConsent
  )
  const logoUrl = brantaLogoUrl(uri, requestsBlocked)

  if (!logoUrl) {
    return null
  }

  if (allowedAlways || consent.session === 'allow') {
    return (
      <Image contentFit="contain" source={{ uri: logoUrl }} style={style} />
    )
  }

  if (consent.session === 'deny') {
    return null
  }

  const waitForConsent = brantaLogoPromptRef(ownerId)

  return (
    <View ref={waitForConsent} style={styles.promptAnchor}>
      {consent.ownerId === ownerId ? (
        <SSModal visible showLabel={false} onClose={denyLogos}>
          <SSVStack gap="md">
            <SSText uppercase weight="medium">
              {t('settings.branta.logoTitle')}
            </SSText>
            <SSText color="muted">{t('settings.branta.logoWarning')}</SSText>
            <SSButton
              label={t('settings.branta.logoCancel')}
              variant="ghost"
              onPress={denyLogos}
            />
            <SSButton
              label={t('settings.branta.logoFetch')}
              variant="outline"
              onPress={allowLogosOnce}
            />
            <SSButton
              label={t('settings.branta.logoFetchAlways')}
              variant="outline"
              onPress={allowLogosAlways}
            />
          </SSVStack>
        </SSModal>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  promptAnchor: {
    position: 'absolute'
  }
})

export default SSBrantaLogo
