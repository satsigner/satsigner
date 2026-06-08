import { Image } from 'expo-image'
import * as WebBrowser from 'expo-web-browser'
import { Pressable, StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import { useBrantaVerification } from '@/hooks/useBrantaVerification'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Typography } from '@/styles'

type SSBrantaVerificationPanelProps = {
  rawContent: string
  isQrSource?: boolean
}

function SSBrantaVerificationPanel({
  rawContent,
  isQrSource = false
}: SSBrantaVerificationPanelProps) {
  const {
    enabled,
    showVerifyButton,
    showClearnetVerifyButton,
    showLoadLogoButton,
    isVerifying,
    isLoadingLogo,
    verification,
    logoUrl,
    logoLoaded,
    torStatus,
    verify,
    verifyOnClearnet,
    loadLogo
  } = useBrantaVerification({ isQrSource, rawContent })

  if (!enabled) {
    return null
  }

  const payment = verification?.payments[0]

  async function openVerifyUrl() {
    if (!verification?.verifyUrl) {
      return
    }
    await WebBrowser.openBrowserAsync(verification.verifyUrl)
  }

  return (
    <SSVStack gap="sm" style={styles.container}>
      {torStatus === 'available' ? (
        <SSText color="muted" size="xs">
          {t('branta.panel.torActive')}
        </SSText>
      ) : torStatus === 'unavailable' ? (
        <SSText color="muted" size="xs">
          {t('branta.panel.clearnetWarning')}
        </SSText>
      ) : null}

      {showVerifyButton ? (
        <SSButton
          label={t('branta.panel.verify')}
          variant="outline"
          loading={isVerifying}
          onPress={() => {
            void verify()
          }}
        />
      ) : null}

      {showClearnetVerifyButton ? (
        <SSButton
          label={t('branta.panel.verifyClearnet')}
          variant="outline"
          loading={isVerifying}
          onPress={() => {
            void verifyOnClearnet()
          }}
        />
      ) : null}

      {isVerifying && !showVerifyButton && !showClearnetVerifyButton ? (
        <SSText color="muted" size="xs">
          {t('branta.panel.loading')}
        </SSText>
      ) : null}

      {payment ? (
        <Pressable onPress={() => void openVerifyUrl()}>
          <SSVStack gap="xs" style={styles.card}>
            {logoLoaded && logoUrl ? (
              <Image
                source={{ uri: logoUrl }}
                style={styles.logo}
                contentFit="contain"
              />
            ) : null}
            {payment.platform ? (
              <SSText weight="bold">{payment.platform}</SSText>
            ) : null}
            {payment.description ? (
              <SSText color="muted" size="sm">
                {payment.description}
              </SSText>
            ) : null}
          </SSVStack>
        </Pressable>
      ) : null}

      {logoUrl ? (
        <SSVStack gap="xs">
          <SSText color="muted" size="xs" uppercase>
            {t('branta.panel.logoUrl')}
          </SSText>
          <SSClipboardCopy text={logoUrl} fullWidth>
            <SSText size="xs" style={styles.logoUrl}>
              {logoUrl}
            </SSText>
          </SSClipboardCopy>
          {showLoadLogoButton ? (
            <SSButton
              label={t('branta.panel.loadLogo')}
              variant="ghost"
              loading={isLoadingLogo}
              onPress={() => {
                void loadLogo()
              }}
            />
          ) : null}
        </SSVStack>
      ) : null}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[700],
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  container: {
    width: '100%'
  },
  logo: {
    height: 40,
    width: 120
  },
  logoUrl: {
    fontFamily: Typography.sfProMono,
    lineHeight: 18
  }
})

export default SSBrantaVerificationPanel
