import { useLocalSearchParams } from 'expo-router'
import { View, Text } from 'react-native'

export default function ExplorerView() {
  const { view } = useLocalSearchParams()
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text
        style={{
          color: 'white',
          textAlign: 'center',
          textAlignVertical: 'center'
        }}
      >
        This View does not exist yet!
      </Text>
    </View>
  )
}
