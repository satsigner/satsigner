import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'

import SSBlockDecoded from '@/components/SSBlockDecoded'
import SSExplorerCapabilityBanner from '@/components/SSExplorerCapabilityBanner'
import SSLoader from '@/components/SSLoader'
import SSText from '@/components/SSText'
import { useExplorerBlockRawHex } from '@/hooks/useExplorerBlockRawHex'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { Colors } from '@/styles'
import {
  BLOCK_DECODE_PREVIEW_CHARS,
  type DecodeBlockResult,
  decodeBlockFromHex
} from '@/utils/blockDecoded'
import { formatNumber } from '@/utils/format'
import { formatHexDump } from '@/utils/hexDump'

const tn = _tn('explorer.block')

const LOADER_SIZE = 80
const HEX_HASH_LENGTH = 64
const HEX_REGEX = /^[0-9a-f]+$/i
/** Keep the page usable; full blocks can be multi-MB as hex. */
const HEX_PREVIEW_CHARS = 8_192
const HEX_DUMP_BYTES_PER_LINE = 16

type HexViewMode = 'raw' | 'dump' | 'decoded'

type HexModeChipProps = {
  active: boolean
  label: string
  mode: HexViewMode
  onSelect: (mode: HexViewMode) => void
}

function HexModeChip({ active, label, mode, onSelect }: HexModeChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => onSelect(mode)}
      style={[styles.hexModeChip, active ? styles.hexModeChipActive : null]}
    >
      <SSText
        color={active ? 'white' : 'muted'}
        size="xxs"
        weight={active ? 'medium' : 'regular'}
      >
        {label}
      </SSText>
    </Pressable>
  )
}

function resolveBlockHashParam(
  block: string | string[] | undefined
): string | null {
  const raw = Array.isArray(block) ? block[0] : block
  if (!raw || raw.length !== HEX_HASH_LENGTH || !HEX_REGEX.test(raw)) {
    return null
  }
  return raw.toLowerCase()
}

function tryDecodeBlock(hex: string): DecodeBlockResult | null {
  try {
    return decodeBlockFromHex(hex, BLOCK_DECODE_PREVIEW_CHARS)
  } catch {
    return null
  }
}

type DecodedBlockViewProps = {
  hex: string
}

function DecodedBlockView({ hex }: DecodedBlockViewProps) {
  const result = tryDecodeBlock(hex)

  if (!result) {
    return (
      <SSText size="xs" color="muted" center>
        {tn('viewHexDecodeError')}
      </SSText>
    )
  }

  return (
    <SSVStack gap="sm">
      {result.truncated ? (
        <SSText size="xxs" color="muted" center>
          {tn('viewHexDecodedTruncated', {
            decoded: formatNumber(result.txDecoded),
            total: formatNumber(result.txTotal)
          })}
        </SSText>
      ) : null}
      <SSBlockDecoded fields={result.fields} />
    </SSVStack>
  )
}

export default function ExplorerBlockHex() {
  const { block: blockParam } = useLocalSearchParams<{ block: string }>()
  const blockHash = resolveBlockHashParam(blockParam)
  const [mode, setMode] = useState<HexViewMode>('raw')

  const { capability, data, isError, isLoading, loadFromMempool, useMempool } =
    useExplorerBlockRawHex(blockHash)
  const needsExternalOptIn = !capability.available && !useMempool
  const hex = data?.hex ?? ''
  const truncated = hex.length > HEX_PREVIEW_CHARS
  const previewHex = truncated ? hex.slice(0, HEX_PREVIEW_CHARS) : hex
  const dumpText =
    mode === 'dump' && previewHex
      ? formatHexDump(previewHex, HEX_DUMP_BYTES_PER_LINE)
      : ''

  return (
    <SSMainLayout style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase numberOfLines={1} adjustsFontSizeToFit>
              {tn('viewHex')}
            </SSText>
          )
        }}
      />
      {blockHash === null ? (
        <SSText color="muted" center>
          {tn('invalidHash')}
        </SSText>
      ) : null}

      {blockHash !== null && needsExternalOptIn ? (
        <SSExplorerCapabilityBanner
          why={t(
            capability.whyKey ?? 'explorer.capability.rawBlock.electrum.why'
          )}
          fix={t(
            capability.fixKey ?? 'explorer.capability.rawBlock.electrum.fix'
          )}
          onLoad={loadFromMempool}
          loading={isLoading}
        />
      ) : null}

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <SSLoader size={LOADER_SIZE} />
        </View>
      ) : null}

      {isError && !isLoading ? (
        <SSText color="muted" center>
          {tn('downloadRawHexError')}
        </SSText>
      ) : null}

      {hex && !isLoading ? (
        <SSVStack gap="sm" style={styles.content}>
          <SSHStack gap="xs" style={styles.hexModeRow}>
            <HexModeChip
              active={mode === 'raw'}
              label={tn('viewHexMode.raw')}
              mode="raw"
              onSelect={setMode}
            />
            <HexModeChip
              active={mode === 'dump'}
              label={tn('viewHexMode.dump')}
              mode="dump"
              onSelect={setMode}
            />
            <HexModeChip
              active={mode === 'decoded'}
              label={tn('viewHexMode.decoded')}
              mode="decoded"
              onSelect={setMode}
            />
          </SSHStack>
          {mode !== 'decoded' && truncated ? (
            <SSText size="xxs" color="muted" center>
              {tn('viewHexTruncated', {
                shown: formatNumber(HEX_PREVIEW_CHARS),
                total: formatNumber(hex.length)
              })}
            </SSText>
          ) : null}
          <ScrollView
            style={styles.hexScroll}
            contentContainerStyle={styles.hexScrollContent}
            nestedScrollEnabled
          >
            {mode === 'decoded' ? (
              <DecodedBlockView hex={hex} />
            ) : mode === 'dump' ? (
              <ScrollView horizontal nestedScrollEnabled>
                <SSText type="mono" size="2xxs" style={styles.hexDumpText}>
                  {dumpText}
                </SSText>
              </ScrollView>
            ) : (
              <SSText type="mono" size="xxs" style={styles.hexText}>
                {previewHex}
              </SSText>
            )}
          </ScrollView>
        </SSVStack>
      ) : null}
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 0,
    paddingTop: 0
  },
  content: {
    flex: 1
  },
  hexDumpText: {
    fontSize: 7,
    lineHeight: 12
  },
  hexModeChip: {
    borderCurve: 'continuous',
    borderRadius: 2,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  hexModeChipActive: {
    backgroundColor: Colors.gray[600]
  },
  hexModeRow: {
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%'
  },
  hexScroll: {
    flex: 1,
    width: '100%'
  },
  hexScrollContent: {
    flexGrow: 1,
    paddingBottom: 24
  },
  hexText: {
    lineHeight: 18
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  }
})
