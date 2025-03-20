import { StyleSheet, View } from 'react-native'

import SSAddressDisplay from './SSAddressDisplay'
import SSButton from './SSButton'
import SSText from './SSText'
import SSTransactionDecoded from './SSTransactionDecoded'

export default () => (
  <View style={styles.container}>
    <SSText size="md">Address display 👇</SSText>
    <SSAddressDisplay address="bc1f5fd90388e8293b3ef4f7c6f06c24aff6314" />
    <SSText size="md">Transaction decoded 👇</SSText>
    <SSTransactionDecoded txHex="0200000000010137131ff2dc9991b6430ba28974b0fc5a3317a6894c00bf0ce2b9f630f7404cca0200000000ffffffff0144e6000000000000160014cc5159408ffdbb39adfd5ed60ac49da7d18a4f4a02483045022100d3727f1e3620114749b9ff8a12a8e55536fa2db45c772dd50d81c46b7a7cf1b60220040f2fb0856f066ddae63f0cef32ed969573e84a17a91b267cafca3f34f5b415012103ef32354a64ce83ff21ed50bea8027e88c13511003ce9a62210956063469373a900000000" />
    <SSText>Happy Coder 💻 is happy 😄!</SSText>
    <SSButton
      label="button"
      onPress={() => console.log('pressed')}
      variant="secondary"
    />
  </View>
)

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000'
  },
  text: {
    fontSize: 24
  }
})
