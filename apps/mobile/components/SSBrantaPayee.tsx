import { Image } from 'expo-image'
import * as WebBrowser from 'expo-web-browser'
import { StyleSheet, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { useSettingsStore } from '@/store/settings'
import { Colors } from '@/styles'
import { type BrantaPayee } from '@/types/models/Branta'
import { brantaHttpsUrl, brantaLogoUrl } from '@/utils/brantaUrl'

import SSPressable from './SSPressable'
import SSText from './SSText'

type SSBrantaPayeeProps = {
  payee: BrantaPayee
  interactive?: boolean
}

const LOGO_SIZE = 44
const PARENT_LOGO_SIZE = 16

function openBrantaVerify(url: string) {
  void WebBrowser.openBrowserAsync(url)
}

function SSBrantaPayee({ payee, interactive = true }: SSBrantaPayeeProps) {
  const torEnabled = useSettingsStore((state) => state.brantaTorEnabled)
  const logoUrl = brantaLogoUrl(payee.logoUrl, torEnabled)
  const parentLogoUrl = brantaLogoUrl(payee.parentLogoUrl, torEnabled)
  const verifyUrl = torEnabled ? undefined : brantaHttpsUrl(payee.verifyUrl)

  function handlePress() {
    if (!verifyUrl) {
      return
    }
    openBrantaVerify(verifyUrl)
  }

  const body = (
    <SSHStack gap="sm" style={styles.row}>
      {logoUrl ? (
        <View>
          <Image
            contentFit="contain"
            source={{ uri: logoUrl }}
            style={styles.logo}
          />
          {parentLogoUrl ? (
            <Image
              contentFit="contain"
              source={{ uri: parentLogoUrl }}
              style={styles.parentLogo}
            />
          ) : null}
        </View>
      ) : null}
      <SSVStack gap="none" style={styles.copy}>
        <SSText numberOfLines={1} weight="medium">
          {payee.name}
        </SSText>
        {payee.description ? (
          <SSText color="muted" numberOfLines={2} size="xs">
            {payee.description}
          </SSText>
        ) : null}
      </SSVStack>
    </SSHStack>
  )

  if (!interactive || !verifyUrl) {
    return <View style={styles.card}>{body}</View>
  }

  return (
    <SSPressable
      accessibilityRole="link"
      accessibilityLabel={payee.name}
      onPress={handlePress}
      style={styles.card}
      testID="branta-payee"
    >
      {body}
    </SSPressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.gray[900],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%'
  },
  copy: {
    flex: 1,
    minWidth: 0
  },
  logo: {
    backgroundColor: Colors.gray[850],
    borderRadius: 8,
    height: LOGO_SIZE,
    width: LOGO_SIZE
  },
  parentLogo: {
    backgroundColor: Colors.white,
    borderRadius: 4,
    bottom: -4,
    height: PARENT_LOGO_SIZE,
    position: 'absolute',
    right: -4,
    width: PARENT_LOGO_SIZE
  },
  row: {
    alignItems: 'center'
  }
})

export default SSBrantaPayee
