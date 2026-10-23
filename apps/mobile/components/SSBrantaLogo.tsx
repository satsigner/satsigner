import { Image, type ImageStyle } from 'expo-image'
import { useEffect, useId, useSyncExternalStore } from 'react'
import { type StyleProp } from 'react-native'

import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import {
  claimBrantaLogoPrompt,
  getBrantaLogoConsent,
  releaseBrantaLogoPrompt,
  setBrantaLogoSession,
  subscribeBrantaLogoConsent
} from '@/utils/brantaLogoConsent'
import { brantaLogoUrl } from '@/utils/brantaUrl'

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
  const torEnabled = useSettingsStore((state) => state.brantaTorEnabled)
  const allowedAlways = useSettingsStore(
    (state) => state.brantaClearnetLogoAllowed
  )
  const consent = useSyncExternalStore(
    subscribeBrantaLogoConsent,
    getBrantaLogoConsent,
    getBrantaLogoConsent
  )
  const logoUrl = brantaLogoUrl(uri, torEnabled)
  const waiting =
    Boolean(logoUrl) && !allowedAlways && consent.session === 'unset'
  const showModal = waiting && consent.ownerId === ownerId

  useEffect(() => {
    if (!waiting) {
      return
    }
    claimBrantaLogoPrompt(ownerId)
    return () => {
      releaseBrantaLogoPrompt(ownerId)
    }
  }, [ownerId, waiting])

  if (!logoUrl) {
    return null
  }

  const allowed = allowedAlways || consent.session === 'allow'
  if (!allowed) {
    if (!showModal) {
      return null
    }
    return (
      <SSModal visible={showModal} showLabel={false} onClose={denyLogos}>
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
    )
  }

  return <Image contentFit="contain" source={{ uri: logoUrl }} style={style} />
}

export default SSBrantaLogo
