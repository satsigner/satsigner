import { Stack } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'

import { MempoolOracle } from '@/api/blockchain'
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
import { type Block } from '@/types/models/Blockchain'

function ExplorerBlock() {
  const mempoolUrl = useBlockchainStore(
    (state) => state.configsMempool['bitcoin']
  )
  const mempoolOracle = useMemo(
    () => new MempoolOracle(mempoolUrl),
    [mempoolUrl]
  )

  const [inputHeight, setInputHeight] = useState('1')
  const [loading, setLoading] = useState(false)
  const [maxBlockHeight, setMaxBlockHeight] = useState(890_000)

  const { height } = useWindowDimensions()
  const padding = 120
  const minHeight = height - padding

  const [block, setBlock] = useState<Block | null>(null)

  function nextBlockHeight() {
    setInputHeight(Math.min(maxBlockHeight, Number(inputHeight) + 1).toString())
  }

  function prevBlockHeight() {
    setInputHeight(Math.max(1, Number(inputHeight) - 1).toString())
  }

  async function fetchBlock() {
    setLoading(true)
    try {
      const block = await mempoolOracle.getBlockAtHeight(Number(inputHeight))
      setBlock(block)
      setInputHeight(block.height.toString())
    } catch {
      //
    } finally {
      setLoading(false)
    }
  }

  async function fetchLatestBlock() {
    const tipHash = await mempoolOracle.getCurrentBlockHash()
    const block = await mempoolOracle.getBlock(tipHash)
    setBlock(block)
    setMaxBlockHeight(block.height)
    setInputHeight(block.height.toString())
  }

  useEffect(() => {
    fetchLatestBlock()
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
        <SSVStack justifyBetween style={{ minHeight }}>
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
            <SSButton disabled={loading} label="Fetch" onPress={fetchBlock} />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  chevronButton: {
    padding: 15,
    borderWidth: 1,
    borderColor: Colors.gray[500],
    borderRadius: 10
  },
  input: {
    textAlign: 'center'
  }
})

export default ExplorerBlock
