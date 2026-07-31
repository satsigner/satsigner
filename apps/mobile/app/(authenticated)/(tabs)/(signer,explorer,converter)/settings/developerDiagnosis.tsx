import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { ScrollView } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { runPayjoinLiveRoundtrip } from '@/utils/payjoinLiveRoundtrip'
import { buildPayjoinLiveRoundtripEnv } from '@/utils/payjoinLiveRoundtripEnv'

type DiagnosisStatus =
  | { kind: 'idle' }
  | { kind: 'running'; step: string }
  | { kind: 'success'; txid: string }
  | { kind: 'failed'; reason: string }

function diagnosisStatusLabel(status: DiagnosisStatus): string {
  if (status.kind === 'idle') {
    return t('settings.developer.diagnosis.status.idle')
  }
  if (status.kind === 'running') {
    return t('settings.developer.diagnosis.status.running', {
      step: status.step
    })
  }
  if (status.kind === 'success') {
    return t('settings.developer.diagnosis.status.success', {
      txid: status.txid
    })
  }
  return t('settings.developer.diagnosis.status.failed', {
    reason: status.reason
  })
}

export default function DeveloperDiagnosis() {
  const router = useRouter()
  const selectedNetwork = useBlockchainStore((state) => state.selectedNetwork)

  const [confirmVisible, setConfirmVisible] = useState(false)
  const [status, setStatus] = useState<DiagnosisStatus>({ kind: 'idle' })
  const [logLines, setLogLines] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const isRunning = status.kind === 'running'
  const canRunRoundtrip = selectedNetwork === 'signet' && !isRunning

  function handleOpenConfirm() {
    setConfirmVisible(true)
  }

  function handleCloseConfirm() {
    setConfirmVisible(false)
  }

  function handleCancelRoundtrip() {
    abortRef.current?.abort()
  }

  async function handleCopyLog() {
    if (logLines.length === 0) {
      return
    }
    await Clipboard.setStringAsync(logLines.join('\n'))
    toast.success(t('common.copiedToClipboard'))
  }

  async function handleRunRoundtrip() {
    setConfirmVisible(false)
    const controller = new AbortController()
    abortRef.current = controller
    setLogLines([])
    setStatus({
      kind: 'running',
      step: t('settings.developer.diagnosis.step.preconditions')
    })

    try {
      const env = await buildPayjoinLiveRoundtripEnv()
      const result = await runPayjoinLiveRoundtrip({
        env,
        onStep: (message) => {
          setLogLines((prev) => [...prev, message])
          setStatus({ kind: 'running', step: message })
        },
        signal: controller.signal
      })
      if (result.ok) {
        setStatus({ kind: 'success', txid: result.txid })
        toast.success(
          t('settings.developer.diagnosis.status.success', {
            txid: result.txid
          })
        )
      } else {
        setStatus({ kind: 'failed', reason: result.error })
        toast.error(result.error)
      }
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : t('settings.developer.diagnosis.error.cancelled')
      setStatus({ kind: 'failed', reason })
      toast.error(reason)
    } finally {
      abortRef.current = null
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => (
            <SSText uppercase>{t('settings.developer.diagnosis.title')}</SSText>
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
              {t('settings.developer.diagnosis.description')}
            </SSText>

            <SSVStack gap="sm">
              <SSText uppercase>
                {t('settings.developer.diagnosis.payjoinRoundtrip.title')}
              </SSText>
              <SSText color="muted" size="sm">
                {t('settings.developer.diagnosis.payjoinRoundtrip.description')}
              </SSText>
              <SSText size="sm">{diagnosisStatusLabel(status)}</SSText>
              {logLines.length > 0 ? (
                <SSVStack gap="xs">
                  {logLines.map((line, index) => (
                    <SSText
                      key={`${index}-${line}`}
                      color="muted"
                      size="xs"
                      type="mono"
                    >
                      {line}
                    </SSText>
                  ))}
                </SSVStack>
              ) : null}
              <SSButton
                label={t('settings.developer.diagnosis.payjoinRoundtrip.run')}
                variant="secondary"
                disabled={!canRunRoundtrip}
                onPress={handleOpenConfirm}
              />
              {isRunning ? (
                <SSButton
                  label={t('settings.developer.diagnosis.cancel')}
                  variant="ghost"
                  onPress={handleCancelRoundtrip}
                />
              ) : null}
              {logLines.length > 0 ? (
                <SSButton
                  label={t('settings.developer.diagnosis.copyLog')}
                  variant="outline"
                  onPress={handleCopyLog}
                />
              ) : null}
            </SSVStack>

            <SSButton
              label={t('common.back')}
              variant="ghost"
              onPress={router.back}
            />
          </SSVStack>
        </ScrollView>
      </SSMainLayout>

      <SSModal
        visible={confirmVisible}
        onClose={handleCloseConfirm}
        label={t('common.cancel')}
      >
        <SSVStack gap="lg">
          <SSText size="lg" weight="medium" center>
            {t('settings.developer.diagnosis.confirm.title')}
          </SSText>
          <SSText color="muted" center>
            {t('settings.developer.diagnosis.confirm.message')}
          </SSText>
          <SSButton
            label={t('settings.developer.diagnosis.confirm.run')}
            variant="danger"
            onPress={handleRunRoundtrip}
          />
        </SSVStack>
      </SSModal>
    </>
  )
}
