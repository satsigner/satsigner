import { StyleSheet, View } from 'react-native'

import SSAddressDisplay from './SSAddressDisplay'
import SSText from './SSText'

type SSAddressDisplayFixtureProps = {
  address: string
  variant: 'default' | 'outline' | 'bare'
}

function SSAddressDisplayFixture({
  address,
  variant
}: SSAddressDisplayFixtureProps) {
  return (
    <View style={styles.container}>
      <SSText size="xl" center uppercase>
        Address display
      </SSText>
      <SSText size="md" uppercase>
        {variant}
      </SSText>
      <SSAddressDisplay address={address} variant={variant} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    gap: 5,
    justifyContent: 'center',
    backgroundColor: '#000'
  }
})

export default (
  <SSAddressDisplayFixture
    address="bc1f5fd90388e8293b3ef4f7c6f06c24aff6314"
    variant="default"
  />
)
