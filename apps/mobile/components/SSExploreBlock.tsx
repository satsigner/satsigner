import React, { useState, useEffect } from 'react'
import { View, Text, TextInput, StyleSheet, ScrollView } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import {
  SSIconChevronUp,
  SSIconChevronDown,
  SSIconChevronLeft,
  SSIconChevronRight
} from '@/components/icons'

export default function ExploreBlock() {
  const { height } = useLocalSearchParams<{ height?: string }>()

  const [inputHeight, setInputHeight] = useState(height ? height : '1')
  const [blockHeight, setBlockHeight] = useState(inputHeight)
  const [blockDetails, setBlockDetails] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    if (!blockHeight) return
    setLoading(true)

    fetch(`https://mempool.space/api/block-height/${blockHeight}`)
      .then((res) => res.text())
      .then((hash) => fetch(`https://mempool.space/api/block/${hash}`))
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
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Block Details</Text>

        <Text style={styles.paramText}>Height: {blockHeight}</Text>

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

        {/* Navigation Controls */}
        <View style={styles.navContainer}>
          <SSIconButton
            onPress={() => {
              const prevHeight = Math.max(parseInt(blockHeight) - 1, 1)
              setBlockHeight(prevHeight.toString())
              setInputHeight(prevHeight.toString())
            }}
            style={styles.chevronButton}
          >
            <SSIconChevronLeft height={22} width={24} />
          </SSIconButton>

          {/* Number Input Field */}
          <TextInput
            style={styles.input}
            value={inputHeight}
            onChangeText={setInputHeight}
            keyboardType="numeric"
            placeholder="Enter block height"
            placeholderTextColor="#888"
            textAlign="center" // Centers text inside input
          />

          <SSIconButton
            onPress={() => {
              const nextHeight = parseInt(blockHeight) + 1
              setBlockHeight(nextHeight.toString())
              setInputHeight(nextHeight.toString())
            }}
            style={styles.chevronButton}
          >
            <SSIconChevronRight height={22} width={24} />
          </SSIconButton>
        </View>

        {/* Fetch Button */}
        <SSButton
          label="Fetch"
          variant="gradient"
          onPress={() => setBlockHeight(inputHeight)}
        />
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  container: {
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    width: '100%',
    maxWidth: 400
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
  },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 50
  },
  chevronButton: {
    height: 50,
    width: 50,
    borderWidth: 1,
    borderColor: '#888',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10
  },
  input: {
    backgroundColor: '#222',
    color: 'white',
    borderWidth: 1,
    borderColor: '#555',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 5,
    width: 80,
    textAlign: 'center', // Centers text inside the input field
    fontSize: 18
  }
})
