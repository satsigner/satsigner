import { useRouter } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import SSButton from '@/components/SSButton'

export default function ExplorerLanding() {
  const router = useRouter()

  console.log('helllooo')
  const navigateToExplorerView = (view: string) => {
    console.log('this is view', view)
    // router.push({ pathname: `/explorer/${view}` } as any)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>SATS SIGNER</Text>
      <Text style={styles.title}>EXPLORER</Text>

      <SSButton
        label="CHAINTIP"
        variant="ghost"
        style={styles.button}
        onPress={() => navigateToExplorerView('chaintip')}
      />
      <SSButton
        label="MEMPOOL"
        variant="ghost"
        style={styles.button}
        onPress={() => navigateToExplorerView('mempool')}
      />
      <SSButton
        label="BLOCK"
        variant="gradient"
        style={styles.button}
        onPress={() => navigateToExplorerView('block')}
      />
      <SSButton
        label="DIFFICULTY"
        variant="gradient"
        style={styles.button}
        onPress={() => navigateToExplorerView('difficulty')}
      />
      <SSButton
        label="HALVING"
        variant="ghost"
        style={styles.button}
        onPress={() => navigateToExplorerView('halving')}
      />
      <SSButton
        label="CHAIN"
        variant="ghost"
        style={styles.button}
        onPress={() => navigateToExplorerView('chain')}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  header: {
    color: 'white',
    fontSize: 18,
    marginBottom: 10
  },
  title: {
    color: 'white',
    fontSize: 24,
    marginBottom: 20
  },
  button: {
    width: '80%',
    marginVertical: 5
  }
})
