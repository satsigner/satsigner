import { StatusBar } from 'expo-status-bar'
import { useState } from 'react'
import { StyleSheet, Text, View, Button } from 'react-native'
import { Mnemonic } from 'bdk-rn'
import { WordCount } from 'bdk-rn/lib/lib/enums'
import { i18n } from '@/locales'
import { Image } from 'expo-image'

export default function App() {
  const [test, setTest] = useState('')

  const handleClick = async () => {
    const mnemonic = await new Mnemonic().create(WordCount.WORDS12)
    setTest(mnemonic.asString())
  }

  return (
    <View style={styles.container}>
      <Text style={{ fontFamily: 'SF Pro Text Bold' }}>
        {i18n.t('satsigner.name')}
      </Text>
      <Button title="Generate" onPress={handleClick} />
      <Image
        source={require('@/assets/icons/settings.svg')}
        style={{ width: 25, height: 25 }}
      />
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
