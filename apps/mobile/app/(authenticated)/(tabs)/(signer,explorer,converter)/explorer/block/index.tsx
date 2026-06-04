import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import { SSIconChevronLeft, SSIconChevronRight } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSExploreBlock, { type Block } from '@/components/SSExploreBlock'
import SSIconButton from '@/components/SSIconButton'
import SSNumberInput from '@/components/SSNumberInput'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'

function getDifficultyFromBits(bits: number): number {
  const exponent = bits >>> 24
  const mantissa = bits & 0x007fffff
  let target = BigInt(mantissa)
  const shift = 8 * (exponent - 3)
  if (shift >= 0) {
    target *= 1n << BigInt(shift)
  } else {
    target /= 1n << BigInt(-shift)
  }
  const maxTarget =
    0x00000000ffff0000000000000000000000000000000000000000000000000000n
  return Number(maxTarget) / Number(target)
}

function ExplorerBlock() {
  const [backendUrl, backend] = useBlockchainStore(
    useShallow((state) => [
      state.configs['bitcoin'].server.url,
      state.configs['bitcoin'].server.backend
    ])
  )

  const { height: windowHeight } = useWindowDimensions()
  const padding = 120
  const minPageHeight = windowHeight - padding

  const { height: heightParam } = useLocalSearchParams<{ height?: string }>()

  const [inputHeight, setInputHeight] = useState(heightParam ?? '1')
  const [loading, setLoading] = useState(false)
  const [maxBlockHeight, setMaxBlockHeight] = useState(890_000)
  const [block, setBlock] = useState<Block | null>(null)

  async function fetchBlockEsplora(height: number): Promise<Block> {
    const esplora = new Esplora(backendUrl)
    const blockHash = await esplora.getBlockAtHeight(height)
    const block = await esplora.getBlockInfo(blockHash)
    return block
  }

  async function fetchBlockElectrum(height: number): Promise<Block> {
    const electrum = await ElectrumClient.initClientFromUrl(backendUrl)
    const block = await electrum.getBlock(height)
    electrum.close()
    return {
      difficulty: getDifficultyFromBits(block.bits),
      height,
      id: block.getId(),
      mediantime: undefined,
      merkle_root: block.merkleRoot?.toString('hex'),
      nonce: block.nonce,
      previousblockhash: block.prevHash?.toString('hex'),
      size: block.weight() * 4,
      timestamp: block.timestamp,
      tx_count: block.transactions?.length,
      version: block.version,
      weight: block.weight()
    }
  }

  async function fetchBlock(height: number) {
    setLoading(true)
    try {
      const block =
        backend === 'esplora'
          ? await fetchBlockEsplora(height)
          : await fetchBlockElectrum(height)
      setBlock(block)
      setInputHeight(height.toString())
      return block
    } catch {
      toast.error(`Failed to fetch block ${block}`)
    } finally {
      setLoading(false)
    }
  }

  async function fetchLatestBlock() {
    let tipHeight: number
    if (backend === 'esplora') {
      const esplora = new Esplora(backendUrl)
      tipHeight = await esplora.getLatestBlockHeight()
    } else {
      const electrum = await ElectrumClient.initClientFromUrl(backendUrl)
      const header = await electrum.subscribeToBlockHeaders()
      tipHeight = header?.height ?? 0
      electrum.close()
    }
    setMaxBlockHeight(tipHeight)
    await fetchBlock(tipHeight)
  }

  function fetchBlockFromInput() {
    const height = Number(inputHeight)
    if (height === block?.height || height > maxBlockHeight || height < 0) {
      toast.error('Invalid block height')
      return
    }
    fetchBlock(height)
  }

  function nextBlockHeight() {
    setInputHeight(Math.min(maxBlockHeight, Number(inputHeight) + 1).toString())
  }

  function prevBlockHeight() {
    setInputHeight(Math.max(1, Number(inputHeight) - 1).toString())
  }

  useEffect(() => {
    if (heightParam) {
      fetchBlock(Number(heightParam))
    } else {
      fetchLatestBlock()
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

export default ExplorerBlock
