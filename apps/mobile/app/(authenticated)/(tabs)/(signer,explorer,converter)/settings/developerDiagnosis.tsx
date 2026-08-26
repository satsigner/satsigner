import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { ScrollView } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import {
  type CheckResults,
  DIAGNOSTIC_CHECKS,
  type DiagnosticCheckId,
  runDiagnosticCheck
} from '@/utils/diagnostics'
import {
  buildDiagnosticsReport,
  type DiagnosticsReportPayload,
  submitDiagnosticsReport
} from '@/utils/diagnosticsReport'
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
  const identityRelays = useNostrIdentityStore((state) => state.relays)

  const [confirmVisible, setConfirmVisible] = useState(false)
  const [status, setStatus] = useState<DiagnosisStatus>({ kind: 'idle' })
  const [logLines, setLogLines] = useState<string[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const [checkResults, setCheckResults] = useState<CheckResults>({})
  const anyCheckRunning = Object.values(checkResults).some(
    (result) => result?.kind === 'running'
  )
  const anyCheckCompleted = Object.values(checkResults).some(
    (result) => result?.kind === 'ok' || result?.kind === 'failed'
  )

  const [reportPayload, setReportPayload] =
    useState<DiagnosticsReportPayload | null>(null)
  const [reportSending, setReportSending] = useState(false)

  async function handleRunCheck(id: DiagnosticCheckId) {
    setCheckResults((prev) => ({ ...prev, [id]: { kind: 'running' } }))
    const result = await runDiagnosticCheck(id, { relayUrls: identityRelays })
    setCheckResults((prev) => ({
      ...prev,
      [id]: result.ok
        ? { kind: 'ok', lines: result.lines }
        : { kind: 'failed', lines: result.lines }
    }))
  }

  async function handleRunAllChecks() {
    for (const { id } of DIAGNOSTIC_CHECKS) {
      await handleRunCheck(id)
    }
  }

  function handleOpenReport() {
    setReportPayload(buildDiagnosticsReport(checkResults, selectedNetwork))
  }

  function handleCloseReport() {
    if (!reportSending) {
      setReportPayload(null)
    }
  }

  async function handleSendReport() {
    if (!reportPayload) {
      return
    }
    setReportSending(true)
    try {
      await submitDiagnosticsReport(reportPayload, identityRelays)
      setReportPayload(null)
      toast.success(t('settings.developer.diagnosis.report.success'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setReportSending(false)
    }
  }

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
      const env = await buildPayjoinLiveRoundtripEnv((message) => {
        setLogLines((prev) => [...prev, message])
        setStatus({ kind: 'running', step: message })
      })
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
                {t('settings.developer.diagnosis.quickChecks.title')}
              </SSText>
              <SSText color="muted" size="sm">
                {t('settings.developer.diagnosis.quickChecks.description')}
              </SSText>
              {DIAGNOSTIC_CHECKS.map(({ id, requiresNetwork }) => {
                const result = checkResults[id]
                return (
                  <SSVStack gap="xs" key={id}>
                    <SSButton
                      label={t(
                        `settings.developer.diagnosis.checks.${id}.title`
                      )}
                      variant="outline"
                      disabled={result?.kind === 'running'}
                      loading={result?.kind === 'running'}
                      onPress={() => handleRunCheck(id)}
                    />
                    {requiresNetwork ? (
                      <SSText color="muted" size="xs">
                        {t(`settings.developer.diagnosis.checks.${id}.hint`)}
                      </SSText>
                    ) : null}
                    {result?.kind === 'ok' || result?.kind === 'failed' ? (
                      <>
                        <SSText
                          size="sm"
                          style={{
                            color:
                              result.kind === 'ok'
                                ? Colors.success
                                : Colors.error
                          }}
                        >
                          {result.kind === 'ok'
                            ? t('settings.developer.diagnosis.checks.statusOk')
                            : t(
                                'settings.developer.diagnosis.checks.statusFailed'
                              )}
                        </SSText>
                        {result.lines.map((line, index) => (
                          <SSText
                            key={`${index}-${line}`}
                            color="muted"
                            size="xs"
                            type="mono"
                          >
                            {line}
                          </SSText>
                        ))}
                      </>
                    ) : null}
                  </SSVStack>
                )
              })}
              <SSButton
                label={t('settings.developer.diagnosis.checks.runAll')}
                variant="outline"
                disabled={anyCheckRunning}
                onPress={handleRunAllChecks}
              />
              <SSButton
                label={t('settings.developer.diagnosis.report.submit')}
                variant="outline"
                disabled={!anyCheckCompleted || anyCheckRunning}
                onPress={handleOpenReport}
              />
            </SSVStack>

            <SSSeparator color="gradient" />

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
                variant="outline"
                disabled={!canRunRoundtrip}
                onPress={handleOpenConfirm}
              />
              {isRunning ? (
                <SSButton
                  label={t('settings.developer.diagnosis.cancel')}
                  variant="outline"
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

            <SSSeparator color="gradient" />

            <SSButton
              label={t('common.back')}
              variant="outline"
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

      <SSModal
        visible={reportPayload !== null}
        onClose={handleCloseReport}
        label={t('common.cancel')}
      >
        <SSVStack gap="lg">
          <SSText size="lg" weight="medium" center>
            {t('settings.developer.diagnosis.report.title')}
          </SSText>
          <SSText color="muted" center>
            {t('settings.developer.diagnosis.report.message')}
          </SSText>
          {reportPayload ? (
            <SSText type="mono" size="xs">
              {JSON.stringify(reportPayload, null, 2)}
            </SSText>
          ) : null}
          <SSButton
            label={t('settings.developer.diagnosis.report.send')}
            variant="outline"
            loading={reportSending}
            onPress={handleSendReport}
          />
        </SSVStack>
      </SSModal>
    </>
  )
}
