import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useRouter } from 'expo-router'
import ExploreBlock from '@/components/SSExploreBlock'
import DifficultyEpoch from '@/components/SSSpiralBlocks'
import SSButton from '@/components/SSButton'

export default function ExplorerViews() {
  const router = useRouter()
  const { view } = useLocalSearchParams<{ view?: string }>()

  const renderView = () => {
    switch (view) {
      /* case 'chaintip':
        return <SSChaintip />
      case 'mempool':
        return <SSMempool />

      case 'difficulty':
        return <SSDifficulty />
      case 'halving':
        return <SSHalving />
      case 'chain':
        return <SSChain />*/
      case 'block':
        return <ExploreBlock />
      case 'difficulty':
        return <DifficultyEpoch />
      default:
        return (
          <Text style={{ color: 'white', textAlign: 'center', marginTop: 20 }}>
            Does not exist yet
          </Text>
        )
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>{renderView()}</View>

      <View style={styles.bottomContainer}>
        <SSButton
          label="Explorer Menu"
          variant="gradient"
          onPress={() => router.navigate('/explorer/')}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  bottomContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 20
  }
})
