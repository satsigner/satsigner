import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { StyleSheet, Switch, TouchableOpacity, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import boltzApi, { BOLTZ_CLEARNET_URL, BOLTZ_ONION_URL } from '@/api/boltz'
import { SSIconSwap } from '@/components/icons'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useSwapStore } from '@/store/swap'
import { Colors } from '@/styles'
import { type AccountSearchParams } from '@/types/navigation/searchParams'

export default function SwapPage() {
  const { id } = useLocalSearchParams<AccountSearchParams>()
  const router = useRouter()
  const [boltzUrl, setBoltzUrl] = useSwapStore(
    useShallow((state) => [state.boltzUrl, state.setBoltzUrl])
  )

  const isOnion = boltzUrl === BOLTZ_ONION_URL

  function toggleNetwork(value: boolean) {
    const newUrl = value ? BOLTZ_ONION_URL : BOLTZ_CLEARNET_URL
    setBoltzUrl(newUrl)
    boltzApi.baseUrl = newUrl
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>Swap</SSText>
        }}
      />
      <SSVStack gap="md" style={styles.container}>
        <TouchableOpacity
          style={styles.card}
          onPress={() =>
            router.navigate(`/account/${id}/swap/bitcoinToLightning`)
          }
          activeOpacity={0.7}
        >
          <SSVStack gap="sm">
            <SSIconSwap width={24} height={24} />
            <SSText weight="medium">Bitcoin → Lightning</SSText>
            <SSText color="muted" size="sm">
              Send on-chain BTC, receive Lightning (into Lightning node or Ecash
              mint)
            </SSText>
          </SSVStack>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() =>
            router.navigate(`/account/${id}/swap/lightningToBitcoin`)
          }
          activeOpacity={0.7}
        >
          <SSVStack gap="sm">
            <SSIconSwap width={24} height={24} />
            <SSText weight="medium">Lightning → Bitcoin</SSText>
            <SSText color="muted" size="sm">
              Pay a Lightning invoice, receive on-chain BTC into this account
            </SSText>
          </SSVStack>
        </TouchableOpacity>

        <View style={styles.networkRow}>
          <SSHStack justifyBetween style={{ alignItems: 'center' }}>
            <SSVStack gap="none">
              <SSText size="sm">Use Tor (onion)</SSText>
              <SSText color="muted" size="xs">
                {isOnion ? 'Onion — requires Tor/Orbot' : 'Clearnet'}
              </SSText>
            </SSVStack>
            <Switch
              value={isOnion}
              onValueChange={toggleNetwork}
              trackColor={{
                false: Colors.gray[700],
                true: Colors.gray[400]
              }}
              thumbColor={Colors.white}
            />
          </SSHStack>
        </View>

        <View style={styles.poweredBy}>
          <SSText color="muted" size="xs" center>
            Powered by Boltz Exchange
          </SSText>
        </View>
      </SSVStack>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 16,
    paddingHorizontal: 4
  },
  card: {
    backgroundColor: Colors.gray[925],
    borderWidth: 1,
    borderColor: Colors.gray[800],
    borderRadius: 8,
    padding: 20
  },
  networkRow: {
    backgroundColor: Colors.gray[925],
    borderWidth: 1,
    borderColor: Colors.gray[800],
    borderRadius: 8,
    padding: 16
  },
  poweredBy: {
    paddingTop: 8
  }
})
