import { Image } from 'expo-image'
import * as WebBrowser from 'expo-web-browser'
import { StyleSheet, TouchableOpacity, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'
import { type BrantaPayee } from '@/types/models/Branta'

import SSText from './SSText'

type SSBrantaPayeeProps = {
  payee: BrantaPayee
  interactive?: boolean
}

const LOGO_SIZE = 44
const PARENT_LOGO_SIZE = 16

function SSBrantaPayee({ payee, interactive = true }: SSBrantaPayeeProps) {
  const body = (
    <SSHStack gap="sm" style={styles.row}>
      {payee.logoUrl ? (
        <View>
          <Image
            contentFit="contain"
            source={{ uri: payee.logoUrl }}
            style={styles.logo}
          />
          {payee.parentLogoUrl ? (
            <Image
              contentFit="contain"
              source={{ uri: payee.parentLogoUrl }}
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

  if (!interactive) {
    return <View style={styles.card}>{body}</View>
  }

  return (
    <TouchableOpacity
      accessibilityRole="link"
      accessibilityLabel={payee.name}
      activeOpacity={0.7}
      onPress={() => {
        void WebBrowser.openBrowserAsync(payee.verifyUrl)
      }}
      style={styles.card}
      testID="branta-payee"
    >
      {body}
    </TouchableOpacity>
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
