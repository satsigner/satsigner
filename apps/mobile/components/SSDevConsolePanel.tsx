import { FlashList } from '@shopify/flash-list'
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle
} from 'react-native'

import SSText from '@/components/SSText'
import { t } from '@/locales'
import { type DevConsoleDock } from '@/store/devConsole'
import { Colors } from '@/styles'
import type {
  DevConsoleEntry,
  DevConsoleLevel
} from '@/types/models/DevConsole'
import { formatDevConsoleTime } from '@/utils/devConsole'

const LEVEL_COLORS: Record<DevConsoleLevel, string> = {
  error: Colors.mainRed,
  info: Colors.gray[100],
  step: Colors.mainGreen,
  warn: Colors.warning
}

const PANEL_EDGE_GAP = 8

const KEEP_LATEST_VISIBLE = {
  autoscrollToBottomThreshold: 0.2,
  startRenderingFromBottom: true
}

export type DevConsolePanelActions = {
  onClear: () => void
  onClose: () => void
  onCopy: () => void
  onHide: () => void
  onNextStep: () => void
  onPause: () => void
  onResume: () => void
  onToggleDock: () => void
  onToggleSession: () => void
}

type ConsoleButtonProps = {
  disabled?: boolean
  label: string
  onPress: () => void
  tone?: 'danger' | 'default' | 'primary'
}

const TONE_TEXT_STYLES = {
  danger: { color: Colors.mainRed },
  default: { color: Colors.gray[75] },
  primary: { color: Colors.mainGreen }
}

function ConsoleButton({
  disabled,
  label,
  onPress,
  tone = 'default'
}: ConsoleButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled
      ]}
    >
      <SSText
        center
        size="xxs"
        type="mono"
        uppercase
        style={TONE_TEXT_STYLES[tone]}
      >
        {label}
      </SSText>
    </Pressable>
  )
}

function renderEntry({ item }: { item: DevConsoleEntry }) {
  return (
    <SSText
      size="xs"
      type="mono"
      style={[styles.entry, { color: LEVEL_COLORS[item.level] }]}
    >
      {`${formatDevConsoleTime(item.time)} [${item.scope}] ${item.message}`}
    </SSText>
  )
}

function entryKey(entry: DevConsoleEntry) {
  return String(entry.id)
}

function statusText(
  pausedSteps: string[],
  showPrevious: boolean,
  visibleCount: number
): string {
  if (pausedSteps.length > 0) {
    return t('devConsole.waiting', { step: pausedSteps[0] })
  }
  return showPrevious
    ? t('devConsole.showingPrevious', { count: visibleCount })
    : t('devConsole.showingCurrent', { count: visibleCount })
}

type SSDevConsolePanelProps = {
  actions: DevConsolePanelActions
  dock: DevConsoleDock
  entries: DevConsoleEntry[]
  pausedSteps: string[]
  showPrevious: boolean
  stepMode: boolean
  style?: StyleProp<ViewStyle>
}

function SSDevConsolePanel({
  actions,
  dock,
  entries,
  pausedSteps,
  showPrevious,
  stepMode,
  style
}: SSDevConsolePanelProps) {
  return (
    <View style={[styles.panel, style]}>
      <View style={styles.row}>
        <ConsoleButton
          label={stepMode ? t('devConsole.resume') : t('devConsole.pause')}
          onPress={stepMode ? actions.onResume : actions.onPause}
        />
        <ConsoleButton
          disabled={pausedSteps.length === 0}
          label={t('devConsole.next', { count: pausedSteps.length })}
          onPress={actions.onNextStep}
          tone="primary"
        />
      </View>
      <View style={styles.row}>
        <ConsoleButton
          label={
            showPrevious
              ? t('devConsole.currentSession')
              : t('devConsole.previousSession')
          }
          onPress={actions.onToggleSession}
        />
        <ConsoleButton label={t('devConsole.copy')} onPress={actions.onCopy} />
        <ConsoleButton
          label={t('devConsole.clear')}
          onPress={actions.onClear}
        />
      </View>
      <View style={styles.row}>
        <ConsoleButton
          label={
            dock === 'top' ? t('devConsole.moveDown') : t('devConsole.moveUp')
          }
          onPress={actions.onToggleDock}
        />
        <ConsoleButton
          label={t('devConsole.close')}
          onPress={actions.onClose}
        />
        <ConsoleButton
          label={t('devConsole.hide')}
          onPress={actions.onHide}
          tone="danger"
        />
      </View>
      <SSText size="xxs" type="mono" uppercase style={styles.status}>
        {statusText(pausedSteps, showPrevious, entries.length)}
      </SSText>
      <View style={styles.log}>
        <FlashList
          data={entries}
          keyExtractor={entryKey}
          maintainVisibleContentPosition={KEEP_LATEST_VISIBLE}
          renderItem={renderEntry}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: Colors.gray[880],
    borderRadius: 3,
    flex: 1,
    justifyContent: 'center',
    minHeight: 28,
    paddingHorizontal: 6
  },
  buttonDisabled: {
    opacity: 0.3
  },
  buttonPressed: {
    opacity: 0.6
  },
  entry: {
    paddingVertical: 1
  },
  log: {
    backgroundColor: Colors.gray[950],
    borderRadius: 3,
    flex: 1,
    padding: 6
  },
  panel: {
    backgroundColor: 'rgba(0, 0, 0, 0.96)',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: PANEL_EDGE_GAP
  },
  row: {
    flexDirection: 'row',
    gap: 6
  },
  status: {
    color: Colors.gray[300]
  }
})

export { PANEL_EDGE_GAP }
export default SSDevConsolePanel
