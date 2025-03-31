import { useState } from 'react'
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native'

import { SSIconChevronLeft, SSIconChevronRight } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSExploreBlock from '@/components/SSExploreBlock'
import SSIconButton from '@/components/SSIconButton'
import SSNumberInput from '@/components/SSNumberInput'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { Colors } from '@/styles'

function ExplorerBlock() {
  const [inputHeight, setInputHeight] = useState('1')

  const { height } = useWindowDimensions()
  const padding = 120
  const minHeight = height - padding

  const block = {
    difficulty: 49402014931.22746,
    hash: '000000000000000015dc777b3ff2611091336355d3f0ee9766a2cf3be8e4b1ce',
    height: 363366,
    nonce: 2892644888,
    prevBlockHash: "000000000000000010c545b6fa3ef1f7cf45a2a8760b1ee9f2e89673218207ce",
    merkleRoot: "9d3cb87bf05ebae366b4262ed5f768ce8c62fc385c3886c9cb097647b04b686c",
    size: 286494,
    timestamp: 1435766771 * 1000,
    medianTime: 1435763435 * 1000,
    txCount: 494,
    version: 2,
    weight: 1145976,
  }

  function nextBlockHeight() {
    setInputHeight((Number(inputHeight) + 1).toString())
  }

  function prevBlockHeight() {
    setInputHeight((Math.max(1, Number(inputHeight) - 1)).toString())
  }

  return (
    <SSMainLayout style={{ paddingBottom: 20, paddingTop: 10 }}>
      <SSVStack justifyBetween style={{ minHeight }}>
        <ScrollView>
          <SSExploreBlock block={block} />
        </ScrollView>
        <SSVStack>
          <SSHStack justifyBetween>
            <SSIconButton
              style={styles.chevronButton}
              onPress={prevBlockHeight}
            >
              <SSIconChevronLeft height={22} width={24} />
            </SSIconButton>
            <View style={{ flexGrow: 1 }}>
              <SSNumberInput
                min={1}
                max={900_000}
                value={inputHeight}
                onChangeText={setInputHeight}
                style={styles.input}
              />
            </View>
            <SSIconButton
              style={styles.chevronButton}
              onPress={nextBlockHeight}
            >
              <SSIconChevronRight height={22} width={24} />
            </SSIconButton>
          </SSHStack>
          <SSButton label="Fetch" />
        </SSVStack>
      </SSVStack>

    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  chevronButton: {
    padding: 15,
    borderWidth: 1,
    borderColor: Colors.gray[600],
    borderRadius: 10
  },
  input: {
    textAlign: 'center'
  }
})

export default ExplorerBlock
