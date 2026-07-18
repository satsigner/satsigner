import { useQuery } from '@tanstack/react-query'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { fetchExplorerTipHeight } from '@/api/explorerBlock'
import { SSIconChevronLeft, SSIconChevronRight } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSNumberInput from '@/components/SSNumberInput'
import SSText from '@/components/SSText'
import {
  type ExplorerExampleBlock,
  EXPLORER_EXAMPLE_BLOCKS
} from '@/constants/explorerExamples'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors, Sizes } from '@/styles'
import { time } from '@/utils/time'

const tn = _tn('explorer.block')

const DEFAULT_MAX_BLOCK_HEIGHT = 890_000

function formatExampleHeight(height: number): string {
  return `Block ${height.toLocaleString('en-US')}`
}

function parseHeightParam(value: string | undefined): number | null {
  if (!value) {
    return null
  }
  const height = Number(value)
  if (!Number.isInteger(height) || height < 0) {
    return null
  }
  return height
}

type ExampleBlockCardProps = {
  example: ExplorerExampleBlock
  onSelect: (height: number) => void
}

function ExampleBlockCard({ example, onSelect }: ExampleBlockCardProps) {
  function handlePress() {
    onSelect(example.height)
  }

  return (
    <TouchableOpacity style={styles.exampleCard} onPress={handlePress}>
      <SSVStack gap="xxs" style={styles.exampleCardContent}>
        <SSText size="sm" weight="medium">
          {example.label}
        </SSText>
        <SSText size="xxs" color="muted">
          {example.description}
        </SSText>
        <SSText type="mono" size="xxs" color="muted">
          {formatExampleHeight(example.height)}
        </SSText>
      </SSVStack>
      <SSIconChevronRight width={12} height={12} stroke={Colors.gray['600']} />
    </TouchableOpacity>
  )
}

export default function ExplorerBlockSearch() {
  const router = useRouter()
  const { height: heightParam } = useLocalSearchParams<{ height?: string }>()
  const legacyHeight = parseHeightParam(heightParam)

  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )
  const { server } = configs[selectedNetwork]
  const showExamples = selectedNetwork === 'bitcoin'

  const tipQuery = useQuery({
    queryFn: () =>
      fetchExplorerTipHeight(server.url, server.backend, server.rpcCredentials),
    queryKey: [
      'explorer-tip-height',
      server.backend,
      server.url,
      selectedNetwork
    ],
    staleTime: time.minutes(1)
  })

  const maxBlockHeight = tipQuery.data ?? DEFAULT_MAX_BLOCK_HEIGHT
  const [inputHeight, setInputHeight] = useState('0')

  const heightNumber = Number(inputHeight)
  const isValidHeight =
    Number.isInteger(heightNumber) &&
    heightNumber >= 0 &&
    heightNumber <= maxBlockHeight
  const atMinHeight = heightNumber <= 0
  const atMaxHeight = heightNumber >= maxBlockHeight

  if (legacyHeight !== null) {
    return <Redirect href={`/explorer/block/${legacyHeight}`} />
  }

  function navigate(height: number) {
    if (!Number.isInteger(height) || height < 0) {
      toast.error(tn('invalid'))
      return
    }
    if (tipQuery.data !== undefined && height > tipQuery.data) {
      toast.error(tn('invalid'))
      return
    }
    router.push(`/explorer/block/${height}`)
  }

  function handleLoad() {
    if (!isValidHeight) {
      toast.error(tn('invalid'))
      return
    }
    navigate(heightNumber)
  }

  function handleExample(height: number) {
    setInputHeight(height.toString())
    navigate(height)
  }

  function handleLatest() {
    if (tipQuery.data === undefined) {
      return
    }
    setInputHeight(tipQuery.data.toString())
    navigate(tipQuery.data)
  }

  function nextBlockHeight() {
    setInputHeight(Math.min(maxBlockHeight, heightNumber + 1).toString())
  }

  function prevBlockHeight() {
    setInputHeight(Math.max(0, heightNumber - 1).toString())
  }

  return (
    <SSMainLayout style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{tn('title')}</SSText>
        }}
      />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SSVStack gap="md" style={styles.inputRow}>
          <SSHStack gap="sm" style={styles.navRow}>
            <SSIconButton
              disabled={atMinHeight}
              style={[
                styles.navButton,
                atMinHeight ? styles.navButtonDisabled : null
              ]}
              onPress={prevBlockHeight}
            >
              <SSIconChevronLeft
                height={18}
                width={18}
                stroke={atMinHeight ? Colors.gray[600] : Colors.white}
              />
            </SSIconButton>
            <View style={styles.navInput}>
              <SSNumberInput
                variant="outline"
                align="center"
                min={0}
                max={maxBlockHeight}
                value={inputHeight}
                onChangeText={setInputHeight}
                placeholder={tn('placeholder')}
              />
            </View>
            <SSIconButton
              disabled={atMaxHeight}
              style={[
                styles.navButton,
                atMaxHeight ? styles.navButtonDisabled : null
              ]}
              onPress={nextBlockHeight}
            >
              <SSIconChevronRight
                height={18}
                width={18}
                stroke={atMaxHeight ? Colors.gray[600] : Colors.white}
              />
            </SSIconButton>
          </SSHStack>
          <SSButton
            label={tn('load')}
            variant="outline"
            onPress={handleLoad}
            disabled={!isValidHeight}
          />
          <SSButton
            label={tn('latest')}
            variant="ghost"
            onPress={handleLatest}
            loading={tipQuery.isLoading || tipQuery.isFetching}
            disabled={tipQuery.data === undefined}
          />
          {showExamples ? (
            <SSVStack gap="none">
              {EXPLORER_EXAMPLE_BLOCKS.map((example) => (
                <ExampleBlockCard
                  key={example.height}
                  example={example}
                  onSelect={handleExample}
                />
              ))}
            </SSVStack>
          ) : null}
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  container: { paddingTop: 0 },
  exampleCard: {
    alignItems: 'center',
    borderBottomColor: Colors.gray['800'],
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14
  },
  exampleCardContent: { flex: 1, paddingRight: 12 },
  inputRow: { paddingTop: 16 },
  navButton: {
    alignItems: 'center',
    borderColor: Colors.gray[700],
    borderCurve: 'continuous',
    borderRadius: 8,
    borderWidth: 1,
    height: Sizes.textInput.height.default,
    justifyContent: 'center',
    width: Sizes.textInput.height.default
  },
  navButtonDisabled: {
    borderColor: Colors.gray[800],
    opacity: 0.55
  },
  navInput: {
    flex: 1
  },
  navRow: {
    alignItems: 'center'
  }
})
