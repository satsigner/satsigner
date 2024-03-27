import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { StyleSheet, Text, View, Button } from 'react-native'
import { Mnemonic } from 'bdk-rn'
import { WordCount } from 'bdk-rn/lib/lib/enums'

export default function App() {
  const [test, setTest] = useState("")

  const handleClick = async () => {
    const mnemonic = await new Mnemonic().create(WordCount.WORDS12)
    setTest(mnemonic.asString())
  }

  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <Button title="Generate" onPress={handleClick} />
      <Text>{test}</Text>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center'
  }
})
