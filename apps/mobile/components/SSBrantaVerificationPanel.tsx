import { Image } from 'expo-image'
import { Pressable, StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSText from '@/components/SSText'
import { useBrantaVerification } from '@/hooks/useBrantaVerification'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors, Typography } from '@/styles'
import { openBrantaVerifyUrl } from '@/utils/branta'

const ADDRESS_PREVIEW_START = 10
const ADDRESS_PREVIEW_END = 6

function trimContent(content: string): string {
  const total = ADDRESS_PREVIEW_START + ADDRESS_PREVIEW_END + 1
  if (content.length <= total) {
    return content
  }
  return `${content.slice(0, ADDRESS_PREVIEW_START)}…${content.slice(-ADDRESS_PREVIEW_END)}`
}

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
    verificationAttempted,
    verificationError,
    normalizedContent,
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

  function handleVerify() {
    void verify()
  }

  function handleVerifyOnClearnet() {
    void verifyOnClearnet()
  }

  function handleLoadLogo() {
    void loadLogo()
  }

  function handleOpenVerifyUrl() {
    void openBrantaVerifyUrl(verification?.verifyUrl)
  }

  return (
    <SSVStack gap="sm" style={styles.container}>
      {showVerifyButton ? (
        <SSButton
          label={t('branta.panel.verify')}
          variant="outline"
          loading={isVerifying}
          style={styles.fullWidth}
          onPress={handleVerify}
        />
      ) : null}

      {showClearnetVerifyButton ? (
        <SSButton
          label={t('branta.panel.verifyClearnet')}
          variant="outline"
          loading={isVerifying}
          style={styles.fullWidth}
          onPress={handleVerifyOnClearnet}
        />
      ) : null}

      {torStatus === 'available' ? (
        <SSVStack gap="xxs">
          <SSHStack gap="xs">
            <View style={styles.torDot} />
            <SSText size="xs" style={styles.torActiveLabel}>
              {t('branta.panel.torActive')}
            </SSText>
          </SSHStack>
          <SSText color="muted" size="xs">
            {t('branta.panel.torActiveDescription')}
          </SSText>
        </SSVStack>
      ) : torStatus === 'unavailable' ? (
        <SSVStack gap="xxs">
          <SSHStack gap="xs">
            <View style={styles.noTorDot} />
            <SSText size="xs" style={styles.noTorLabel}>
              {t('branta.panel.clearnetWarning')}
            </SSText>
          </SSHStack>
          <SSText color="muted" size="xs">
            {t('branta.panel.clearnetWarningDescription')}
          </SSText>
        </SSVStack>
      ) : null}

      {isVerifying && !showVerifyButton && !showClearnetVerifyButton ? (
        <SSText color="muted" size="xs">
          {t('branta.panel.loading')}
        </SSText>
      ) : null}

      {verificationAttempted && !isVerifying ? (
        verification?.payments.length ? (
          <SSHStack gap="xs">
            <SSText size="xs" style={styles.addressValidLabel}>
              {t('branta.panel.addressValid')}
            </SSText>
            <SSText color="muted" size="xs" style={styles.addressPreview}>
              {trimContent(normalizedContent)}
            </SSText>
          </SSHStack>
        ) : verificationError ? (
          <SSVStack gap="xxs">
            <SSText size="xs" style={styles.checkFailedLabel}>
              {t('branta.panel.connectionFailed')}
            </SSText>
            <SSText color="muted" size="xs">
              {verificationError.message}
            </SSText>
          </SSVStack>
        ) : (
          <SSText size="xs" style={styles.checkFailedLabel}>
            {t('branta.panel.checkFailed')}
          </SSText>
        )
      ) : null}

      {payment ? (
        <Pressable onPress={handleOpenVerifyUrl}>
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
              onPress={handleLoadLogo}
            />
          ) : null}
        </SSVStack>
      ) : null}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  addressPreview: {
    fontFamily: Typography.sfProMono
  },
  addressValidLabel: {
    color: Colors.mainGreen
  },
  card: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[700],
    borderRadius: 8,
    borderWidth: 1,
    padding: 12
  },
  checkFailedLabel: {
    color: Colors.mainRed
  },
  container: {
    alignSelf: 'stretch',
    width: '100%'
  },
  fullWidth: {
    width: '100%'
  },
  logo: {
    height: 40,
    width: 120
  },
  logoUrl: {
    fontFamily: Typography.sfProMono,
    lineHeight: 18
  },
  noTorDot: {
    backgroundColor: Colors.warning,
    borderRadius: 4,
    height: 8,
    width: 8
  },
  noTorLabel: {
    color: Colors.warning
  },
  torActiveLabel: {
    color: Colors.white
  },
  torDot: {
    backgroundColor: Colors.purple,
    borderRadius: 4,
    height: 8,
    width: 8
  }
})

export default SSBrantaVerificationPanel
