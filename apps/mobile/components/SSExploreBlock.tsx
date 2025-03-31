import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import { SSIconChevronLeft, SSIconChevronRight } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import { t } from '@/locales'

const MEMPOOL_API_BASE_URL = 'https://mempool.space/api'
const DEFAULT_HEIGHT = '1'
const CHEVRON_ICON_HEIGHT = 22
const CHEVRON_ICON_WIDTH = 24
const INPUT_PLACEHOLDER = 'Enter block height'
const PLACEHOLDER_TEXT_COLOR = '#888'

export default function SSExploreBlock() {
  const { height } = useLocalSearchParams<{ height?: string }>()
  const [inputHeight, setInputHeight] = useState(
    height ? height : DEFAULT_HEIGHT
  )
  const [blockHeight, setBlockHeight] = useState(inputHeight)
  const [blockDetails, setBlockDetails] = useState<any>(null)
  const [loading, setLoading] = useState<boolean>(false)

  function handleBlockPress() {
      const prevHeight = Math.max(parseInt(blockHeight, 10) - 1, 1)
      setBlockHeight(prevHeight.toString())
      setInputHeight(prevHeight.toString())
  }

  useEffect(() => {
    const fetchBlockDetails = async () => {
      if (!blockHeight) return
      setLoading(true)

      try {
        const hashResponse = await fetch(
          `${MEMPOOL_API_BASE_URL}/block-height/${blockHeight}`
        )
        const hash = await hashResponse.text()
        const blockResponse = await fetch(
          `${MEMPOOL_API_BASE_URL}/block/${hash}`
        )
        const data = await blockResponse.json()
        setBlockDetails(data)
      } catch (error) {
        throw new Error('Error fetching block details:' + error)
      } finally {
        setLoading(false)
      }
    }

    fetchBlockDetails()
  }, [blockHeight])

  return (
    <ScrollView contentContainerStyle={STYLES.scrollContainer}>
      <View style={STYLES.container}>
        <Text style={STYLES.title}>{t('explorer.block.title')}</Text>
        <Text style={STYLES.paramText}>
          {t('explorer.block.heightLabel')} {blockHeight}
        </Text>
        <View style={STYLES.whiteRectangle} />
        {loading ? (
          <Text style={STYLES.statusText}>Loading block details...</Text>
        ) : blockDetails ? (
          <>
            <Text style={STYLES.statusText}>
              Block ID: {String(blockDetails.id)}
            </Text>
            <Text style={STYLES.statusText}>
              Difficulty: {String(blockDetails.difficulty)}
            </Text>
            <Text style={STYLES.statusText}>
              Timestamp: {String(blockDetails.timestamp)}
            </Text>
          </>
        ) : (
          <Text style={STYLES.statusText}>No block details available.</Text>
        )}
        <View style={STYLES.navContainer}>
          <SSIconButton
            onPress={handleBlockPress}
            style={STYLES.chevronButton}
          >
            <SSIconChevronLeft
              height={CHEVRON_ICON_HEIGHT}
              width={CHEVRON_ICON_WIDTH}
            />
          </SSIconButton>
          <TextInput
            style={STYLES.input}
            value={inputHeight}
            onChangeText={setInputHeight}
            keyboardType="numeric"
            placeholder={INPUT_PLACEHOLDER}
            placeholderTextColor={PLACEHOLDER_TEXT_COLOR}
            textAlign="center"
          />
          <SSIconButton
            onPress={() => {
              const nextHeight = parseInt(blockHeight, 10) + 1
              setBlockHeight(nextHeight.toString())
              setInputHeight(nextHeight.toString())
            }}
            style={STYLES.chevronButton}
          >
            <SSIconChevronRight
              height={CHEVRON_ICON_HEIGHT}
              width={CHEVRON_ICON_WIDTH}
            />
          </SSIconButton>
        </View>
        <SSButton
          label="Fetch"
          variant="gradient"
          onPress={() => setBlockHeight(inputHeight)}
        />
      </View>
    </ScrollView>
  )
}

const STYLES = StyleSheet.create({
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
    textAlign: 'center',
    fontSize: 18
  }
})
