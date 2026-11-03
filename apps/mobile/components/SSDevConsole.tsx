import { FlashList } from '@shopify/flash-list'
import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSText from '@/components/SSText'
import { t } from '@/locales'
import { useDevConsoleStore } from '@/store/devConsole'
import { Colors } from '@/styles'
import type {
  DevConsoleEntry,
  DevConsoleLevel
} from '@/types/models/DevConsole'
import {
  clearDevConsole,
  closeDevConsole,
  copyDevConsoleEntries,
  formatDevConsoleTime,
  hideDevConsole,
  openDevConsole,
  pauseDevSteps,
  releaseNextDevStep,
  resumeDevSteps,
  toggleDevConsoleDock,
  toggleDevConsoleSession
} from '@/utils/devConsole'

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

type ConsoleButtonProps = {
  disabled?: boolean
  label: string
  onPress: () => void
  tone?: 'danger' | 'default' | 'primary'
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
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'primary' && styles.buttonPrimary,
        tone === 'danger' && styles.buttonDanger,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled
      ]}
    >
      <SSText center size="sm" type="mono" uppercase weight="medium">
        {label}
      </SSText>
    </Pressable>
  )
}

async function handleCopy() {
  const copied = await copyDevConsoleEntries()
  if (copied) {
    toast.success(t('devConsole.copied'))
    return
  }
  toast.error(t('devConsole.copyFailed'))
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

export default function SSDevConsole() {
  const insets = useSafeAreaInsets()
  const [
    dock,
    entries,
    panelOpen,
    pausedSteps,
    previousEntries,
    showPrevious,
    stepMode
  ] = useDevConsoleStore(
    useShallow((state) => [
      state.dock,
      state.entries,
      state.panelOpen,
      state.pausedSteps,
      state.previousEntries,
      state.showPrevious,
      state.stepMode
    ])
  )

  if (!panelOpen) {
    return (
      <Pressable
        hitSlop={8}
        onPress={openDevConsole}
        style={[styles.pill, { bottom: insets.bottom + 24 }]}
      >
        <SSText size="sm" type="mono" uppercase weight="medium">
          {pausedSteps.length > 0
            ? t('devConsole.pillPaused', { count: entries.length })
            : t('devConsole.pill', { count: entries.length })}
        </SSText>
      </Pressable>
    )
  }

  const visibleEntries = showPrevious ? previousEntries : entries
  const dockStyle =
    dock === 'top'
      ? { paddingTop: insets.top + PANEL_EDGE_GAP, top: 0 }
      : { bottom: 0, paddingBottom: insets.bottom + PANEL_EDGE_GAP }

  return (
    <View style={[styles.panel, dockStyle]}>
      <View style={styles.row}>
        <ConsoleButton
          label={stepMode ? t('devConsole.resume') : t('devConsole.pause')}
          onPress={stepMode ? resumeDevSteps : pauseDevSteps}
        />
        <ConsoleButton
          disabled={pausedSteps.length === 0}
          label={t('devConsole.next', { count: pausedSteps.length })}
          onPress={releaseNextDevStep}
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
          onPress={toggleDevConsoleSession}
        />
        <ConsoleButton label={t('devConsole.copy')} onPress={handleCopy} />
        <ConsoleButton
          label={t('devConsole.clear')}
          onPress={clearDevConsole}
        />
      </View>
      <View style={styles.row}>
        <ConsoleButton
          label={
            dock === 'top' ? t('devConsole.moveDown') : t('devConsole.moveUp')
          }
          onPress={toggleDevConsoleDock}
        />
        <ConsoleButton
          label={t('devConsole.close')}
          onPress={closeDevConsole}
        />
        <ConsoleButton
          label={t('devConsole.hide')}
          onPress={hideDevConsole}
          tone="danger"
        />
      </View>
      <SSText size="xs" type="mono" style={styles.status}>
        {statusText(pausedSteps, showPrevious, visibleEntries.length)}
      </SSText>
      <View style={styles.log}>
        <FlashList
          data={visibleEntries}
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
    backgroundColor: Colors.gray[850],
    borderColor: Colors.gray[600],
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 6
  },
  buttonDanger: {
    backgroundColor: '#3a1515',
    borderColor: Colors.error
  },
  buttonDisabled: {
    opacity: 0.35
  },
  buttonPressed: {
    opacity: 0.6
  },
  buttonPrimary: {
    backgroundColor: Colors.barGreen,
    borderColor: Colors.mainGreen
  },
  entry: {
    paddingVertical: 1
  },
  log: {
    borderColor: Colors.gray[700],
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    padding: 6
  },
  panel: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    borderColor: Colors.gray[700],
    borderWidth: 1,
    gap: 8,
    height: '55%',
    left: 0,
    paddingHorizontal: 10,
    paddingVertical: PANEL_EDGE_GAP,
    position: 'absolute',
    right: 0,
    zIndex: 1_000_000
  },
  pill: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderColor: Colors.gray[500],
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    left: 12,
    minHeight: 36,
    paddingHorizontal: 14,
    position: 'absolute',
    zIndex: 1_000_000
  },
  row: {
    flexDirection: 'row',
    gap: 8
  },
  status: {
    color: Colors.gray[200]
  }
})
