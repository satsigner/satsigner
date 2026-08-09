import { Stack, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ScrollView } from 'react-native'

import SSButton from '@/components/SSButton'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import {
  type EntropySoakStats,
  runEntropySoak
} from '@/utils/entropySoak'

type SoakStatus =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'stopped' }
  | {
      kind: 'collision'
      source: 'uuid' | 'iv'
      window: number
      duplicates: number
    }
  | { kind: 'malformed'; detail: string }

function soakStatusLabel(status: SoakStatus): string {
  switch (status.kind) {
    case 'idle':
      return t('settings.developer.entropySoak.status.idle')
    case 'running':
      return t('settings.developer.entropySoak.status.running')
    case 'stopped':
      return t('settings.developer.entropySoak.status.stopped')
    case 'collision':
      return t('settings.developer.entropySoak.status.collision', {
        source: status.source,
        window: status.window,
        duplicates: status.duplicates.toLocaleString()
      })
    case 'malformed':
      return t('settings.developer.entropySoak.status.malformed', {
        detail: status.detail
      })
  }
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString()
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <SSHStack justifyBetween>
      <SSText color="muted" size="sm">
        {label}
      </SSText>
      <SSText size="sm" type="mono">
        {value}
      </SSText>
    </SSHStack>
  )
}

export default function DeveloperEntropySoak() {
  const router = useRouter()
  const abortRef = useRef<AbortController | null>(null)
  const [status, setStatus] = useState<SoakStatus>({ kind: 'idle' })
  const [stats, setStats] = useState<EntropySoakStats | null>(null)

  const isRunning = status.kind === 'running'

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  async function handleStart() {
    const controller = new AbortController()
    abortRef.current = controller
    setStatus({ kind: 'running' })
    setStats(null)

    const result = await runEntropySoak({
      signal: controller.signal,
      onStats: setStats
    })

    abortRef.current = null
    if (result.kind === 'collision') {
      setStatus({
        kind: 'collision',
        source: result.source,
        window: result.window,
        duplicates: result.duplicates
      })
    } else if (result.kind === 'malformed') {
      setStatus({ kind: 'malformed', detail: result.detail })
    } else {
      setStatus({ kind: 'stopped' })
    }
    setStats(result.stats)
  }

  function handleStop() {
    abortRef.current?.abort()
  }

  const statusFailed =
    status.kind === 'collision' || status.kind === 'malformed'

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => (
            <SSText uppercase>
              {t('settings.developer.entropySoak.title')}
            </SSText>
          )
        }}
      />
      <SSMainLayout>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SSVStack gap="lg">
            <SSText color="muted">
              {t('settings.developer.entropySoak.description')}
            </SSText>

            <SSText
              size="sm"
              style={{
                color: statusFailed
                  ? Colors.error
                  : isRunning
                    ? Colors.success
                    : Colors.gray[300]
              }}
            >
              {soakStatusLabel(status)}
            </SSText>

            {stats ? (
              <SSVStack gap="sm">
                <StatRow
                  label={t('settings.developer.entropySoak.stats.elapsed')}
                  value={formatElapsed(stats.elapsedMs)}
                />
                <StatRow
                  label={t('settings.developer.entropySoak.stats.windows')}
                  value={formatCount(stats.windows)}
                />
                <StatRow
                  label={t('settings.developer.entropySoak.stats.uuidSamples')}
                  value={formatCount(stats.uuidSamples)}
                />
                <StatRow
                  label={t('settings.developer.entropySoak.stats.ivSamples')}
                  value={formatCount(stats.ivSamples)}
                />
                <StatRow
                  label={t(
                    'settings.developer.entropySoak.stats.totalSamples'
                  )}
                  value={formatCount(stats.uuidSamples + stats.ivSamples)}
                />
                <StatRow
                  label={t('settings.developer.entropySoak.stats.rate')}
                  value={formatCount(stats.samplesPerSecond)}
                />
                {stats.lastWindowMs !== null ? (
                  <StatRow
                    label={t(
                      'settings.developer.entropySoak.stats.lastWindow'
                    )}
                    value={`${formatCount(stats.lastWindowMs)} ms`}
                  />
                ) : null}
                {stats.minWindowMs !== null && stats.maxWindowMs !== null ? (
                  <StatRow
                    label={t(
                      'settings.developer.entropySoak.stats.windowRange'
                    )}
                    value={`${formatCount(stats.minWindowMs)} / ${formatCount(stats.maxWindowMs)} ms`}
                  />
                ) : null}
              </SSVStack>
            ) : null}

            <SSVStack gap="sm">
              <SSButton
                label={t('settings.developer.entropySoak.start')}
                variant="outline"
                disabled={isRunning}
                onPress={handleStart}
              />
              {isRunning ? (
                <SSButton
                  label={t('settings.developer.entropySoak.stop')}
                  variant="outline"
                  onPress={handleStop}
                />
              ) : null}
            </SSVStack>

            <SSSeparator color="gradient" />

            <SSButton
              label={t('common.back')}
              variant="outline"
              onPress={router.back}
            />
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}
