import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSPressable from '@/components/SSPressable'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { DiagnosticResult, DiagnosticStatus } from '@/utils/diagnostics'

const STATUS_COLORS: Record<DiagnosticStatus, string> = {
  fail: Colors.error,
  ok: Colors.success,
  skipped: Colors.gray[500],
  warn: Colors.warning
}

type SSDiagnosticsCheckRowProps = {
  checkId: string
  disabled: boolean
  onRun: (checkId: string) => void
  result?: DiagnosticResult
  running: boolean
}

function SSDiagnosticsCheckRow({
  checkId,
  disabled,
  onRun,
  result,
  running
}: SSDiagnosticsCheckRowProps) {
  const [expanded, setExpanded] = useState(false)
  const showLines = result && (expanded || result.status !== 'ok')

  function handleToggle() {
    setExpanded((value) => !value)
  }

  function handleRun() {
    onRun(checkId)
  }

  return (
    <SSVStack gap="xs" style={styles.row}>
      <SSPressable onPress={handleToggle}>
        <SSHStack justifyBetween>
          <SSText size="sm" style={styles.title}>
            {t(`settings.developer.diagnosis.checks.${checkId}.title`)}
          </SSText>
          {result ? (
            <SSText
              size="xs"
              uppercase
              style={{ color: STATUS_COLORS[result.status] }}
            >
              {t(`settings.developer.diagnosis.result.${result.status}`)}
            </SSText>
          ) : null}
        </SSHStack>
      </SSPressable>
      {showLines ? (
        <View>
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
          <SSText color="muted" size="xxs">
            {t('settings.developer.diagnosis.result.duration', {
              ms: result.durationMs
            })}
          </SSText>
        </View>
      ) : null}
      {expanded || running ? (
        <SSButton
          label={t('settings.developer.diagnosis.result.rerun')}
          variant="ghost"
          disabled={disabled}
          loading={running}
          onPress={handleRun}
        />
      ) : null}
    </SSVStack>
  )
}

const styles = StyleSheet.create({
  row: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    paddingVertical: 8
  },
  title: {
    flexShrink: 1
  }
})

export default SSDiagnosticsCheckRow
