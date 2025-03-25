import { StyleSheet, View } from 'react-native'

import { parseHexToBytes } from '@/utils/parse'

import SSScriptDecoded from './SSScriptDecoded'
import SSText from './SSText'

function SSScriptDecodedFixture() {
  const script = '76a91498b2553c30629340fac2a7729cf2f2100cdbb98d88ac'
  return (
    <View style={styles.container}>
      <SSText size="xl" center uppercase>
        Script Decoded
      </SSText>
      <SSScriptDecoded script={parseHexToBytes(script)} />
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

export default SSScriptDecodedFixture
