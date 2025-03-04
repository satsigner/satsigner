import React, { useState, useEffect } from 'react'
import { View, Text, Button, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import SSButton from '@/components/SSButton'

export default function ExploreBlock() {
  const { height } = useLocalSearchParams<{ height?: string }>()
  const router = useRouter()

  const blockHeight = height ? height : 999

  const [blockDetails, setBlockDetails] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    if (!blockHeight) return
    setLoading(true)

    fetch(`https://mempool.space/api/block-height/${blockHeight}`)
      .then((res) => res.text())
      .then((hash) => {
        return fetch(`https://mempool.space/api/block/${hash}`)
      })
      .then((res) => res.json())
      .then((data) => {
        setBlockDetails(data)
        console.log(data)
      })
      .catch((error) => {
        console.error('Error fetching block details:', error)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [blockHeight])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Block Details</Text>
      <Text style={styles.paramText}>Height: {blockHeight}</Text>
      {/* White rectangle added above the text details */}
      <View style={styles.whiteRectangle} />
      {loading ? (
        <Text style={styles.statusText}>Loading block details...</Text>
      ) : blockDetails ? (
        <>
          <Text style={styles.statusText}>
            Block ID: {String(blockDetails.id)}
          </Text>
          <Text style={styles.statusText}>
            Difficulty: {String(blockDetails.difficulty)}
          </Text>
          <Text style={styles.statusText}>
            Timestamp: {String(blockDetails.timestamp)}
          </Text>
        </>
      ) : (
        <Text style={styles.statusText}>No block details available.</Text>
      )}
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
  title: {
    color: 'white',
    fontSize: 24,
    marginBottom: 20
  },
  paramText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 10
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center'
  },
  whiteRectangle: {
    width: 100,
    height: 100,
    backgroundColor: 'white',
    marginVertical: 20
  }
})
