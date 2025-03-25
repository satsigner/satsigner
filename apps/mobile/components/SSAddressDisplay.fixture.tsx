import { StyleSheet, View } from 'react-native'

import SSAddressDisplay from './SSAddressDisplay'
import SSText from './SSText'

function SSAddressDisplayFixture() {
  const address = 'bc1f5fd90388e8293b3ef4f7c6f06c24aff6314'
  return (
    <View style={styles.container}>
      <SSText size="xl" center uppercase>
        Address display
      </SSText>
      <SSText size="md">Default</SSText>
      <SSAddressDisplay address={address} />
      <SSText size="md">Outline</SSText>
      <SSAddressDisplay address={address} variant="outline" />
      <SSText size="md">Bare</SSText>
      <SSAddressDisplay address={address} variant="bare" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    gap:5,
    justifyContent: 'center',
    backgroundColor: '#000'
  },
  text: {
    fontSize: 24
  }
})

export default SSAddressDisplayFixture
