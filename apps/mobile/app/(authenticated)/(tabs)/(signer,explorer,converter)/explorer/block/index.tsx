import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import {
  type ExplorerBlock,
  fetchExplorerBlock,
  fetchExplorerTipHeight
} from '@/api/explorerBlock'
import { SSIconChevronLeft, SSIconChevronRight } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSExploreBlock from '@/components/SSExploreBlock'
import SSIconButton from '@/components/SSIconButton'
import SSNumberInput from '@/components/SSNumberInput'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'

const DEFAULT_MAX_BLOCK_HEIGHT = 890_000
const PAGE_PADDING = 120

function ExplorerBlockPage() {
  const [backendUrl, backend, rpcCredentials] = useBlockchainStore(
    useShallow((state) => [
      state.configs['bitcoin'].server.url,
      state.configs['bitcoin'].server.backend,
      state.configs['bitcoin'].server.rpcCredentials
    ])
  )

  const { height: windowHeight } = useWindowDimensions()
  const minPageHeight = windowHeight - PAGE_PADDING

  const { height: heightParam } = useLocalSearchParams<{ height?: string }>()

  const [inputHeight, setInputHeight] = useState(heightParam ?? '1')
  const [loading, setLoading] = useState(false)
  const [maxBlockHeight, setMaxBlockHeight] = useState(DEFAULT_MAX_BLOCK_HEIGHT)
  const [block, setBlock] = useState<ExplorerBlock | null>(null)

  async function loadBlock(height: number) {
    setLoading(true)
    try {
      const nextBlock = await fetchExplorerBlock(
        backendUrl,
        backend,
        height,
        rpcCredentials
      )
      setBlock(nextBlock)
      setInputHeight(height.toString())
      return nextBlock
    } catch {
      toast.error(`Failed to fetch block ${height}`)
    } finally {
      setLoading(false)
    }
  }

  async function loadLatestBlock() {
    const tipHeight = await fetchExplorerTipHeight(
      backendUrl,
      backend,
      rpcCredentials
    )
    setMaxBlockHeight(tipHeight)
    await loadBlock(tipHeight)
  }

  function fetchBlockFromInput() {
    const height = Number(inputHeight)
    if (height === block?.height || height > maxBlockHeight || height < 0) {
      toast.error('Invalid block height')
      return
    }
    loadBlock(height)
  }

  function nextBlockHeight() {
    setInputHeight(Math.min(maxBlockHeight, Number(inputHeight) + 1).toString())
  }

  function prevBlockHeight() {
    setInputHeight(Math.max(1, Number(inputHeight) - 1).toString())
  }

  useEffect(() => {
    if (heightParam) {
      loadBlock(Number(heightParam))
    } else {
      loadLatestBlock()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('explorer.block.title')}</SSText>
          )
        }}
      />
      <SSMainLayout style={{ paddingBottom: 20, paddingTop: 0 }}>
        <SSVStack justifyBetween style={{ minHeight: minPageHeight }}>
          <SSExploreBlock block={block} />
          <SSVStack>
            <SSHStack justifyBetween>
              <SSIconButton
                style={[
                  styles.chevronButton,
                  {
                    borderColor:
                      inputHeight === '1' ? Colors.barRed : Colors.gray[500]
                  }
                ]}
                onPress={prevBlockHeight}
              >
                <SSIconChevronLeft
                  height={22}
                  width={24}
                  stroke={
                    inputHeight === '1' ? Colors.barRed : Colors.gray[500]
                  }
                />
              </SSIconButton>
              <View style={{ flexGrow: 1 }}>
                <SSNumberInput
                  min={1}
                  max={maxBlockHeight}
                  value={inputHeight}
                  onChangeText={setInputHeight}
                  style={styles.input}
                />
              </View>
              <SSIconButton
                style={[
                  styles.chevronButton,
                  {
                    borderColor:
                      inputHeight === `${maxBlockHeight}`
                        ? Colors.barRed
                        : Colors.gray[500]
                  }
                ]}
                onPress={nextBlockHeight}
              >
                <SSIconChevronRight
                  height={22}
                  width={24}
                  stroke={
                    inputHeight === `${maxBlockHeight}`
                      ? Colors.barRed
                      : Colors.gray[500]
                  }
                />
              </SSIconButton>
            </SSHStack>
            <SSButton
              loading={loading}
              disabled={Number(inputHeight) === block?.height}
              label="Fetch"
              onPress={fetchBlockFromInput}
            />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  chevronButton: {
    borderColor: Colors.gray[500],
    borderRadius: 10,
    borderWidth: 1,
    padding: 15
  },
  input: {
    textAlign: 'center'
  }
})

export default ExplorerBlockPage
