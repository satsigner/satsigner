import { FlashList } from '@shopify/flash-list'
import { Pressable, StyleSheet, View } from 'react-native'
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
  formatDevConsoleTime,
  openDevConsole,
  pauseDevSteps,
  releaseNextDevStep,
  resumeDevSteps,
  toggleDevConsoleSession
} from '@/utils/devConsole'

const LEVEL_COLORS: Record<DevConsoleLevel, string> = {
  error: Colors.mainRed,
  info: Colors.gray[100],
  step: Colors.mainGreen,
  warn: Colors.warning
}

type ConsoleButtonProps = {
  disabled?: boolean
  label: string
  onPress: () => void
}

function ConsoleButton({ disabled, label, onPress }: ConsoleButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, disabled && styles.buttonDisabled]}
    >
      <SSText size="xs" type="mono" uppercase>
        {label}
      </SSText>
    </Pressable>
  )
}

function renderEntry({ item }: { item: DevConsoleEntry }) {
  return (
    <SSText size="xxs" type="mono" style={{ color: LEVEL_COLORS[item.level] }}>
      {`${formatDevConsoleTime(item.time)} [${item.scope}] ${item.message}`}
    </SSText>
  )
}

const KEEP_LATEST_VISIBLE = {
  autoscrollToBottomThreshold: 0.2,
  startRenderingFromBottom: true
}

function entryKey(entry: DevConsoleEntry) {
  return String(entry.id)
}

export default function SSDevConsole() {
  const [
    entries,
    panelOpen,
    pausedSteps,
    previousEntries,
    showPrevious,
    stepMode
  ] = useDevConsoleStore(
    useShallow((state) => [
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
      <Pressable onPress={openDevConsole} style={styles.pill}>
        <SSText size="xs" type="mono" uppercase>
          {pausedSteps.length > 0
            ? t('devConsole.pillPaused', { count: entries.length })
            : t('devConsole.pill', { count: entries.length })}
        </SSText>
      </Pressable>
    )
  }

  const visibleEntries = showPrevious ? previousEntries : entries

  return (
    <View style={styles.panel}>
      <View style={styles.toolbar}>
        <ConsoleButton
          label={stepMode ? t('devConsole.resume') : t('devConsole.pause')}
          onPress={stepMode ? resumeDevSteps : pauseDevSteps}
        />
        <ConsoleButton
          disabled={pausedSteps.length === 0}
          label={t('devConsole.next', { count: pausedSteps.length })}
          onPress={releaseNextDevStep}
        />
        <ConsoleButton
          label={
            showPrevious
              ? t('devConsole.currentSession')
              : t('devConsole.previousSession')
          }
          onPress={toggleDevConsoleSession}
        />
        <ConsoleButton
          label={t('devConsole.clear')}
          onPress={clearDevConsole}
        />
        <ConsoleButton label={t('devConsole.hide')} onPress={closeDevConsole} />
      </View>
      <SSText size="xs" type="mono" style={styles.status}>
        {pausedSteps.length > 0
          ? t('devConsole.waiting', { step: pausedSteps[0] })
          : showPrevious
            ? t('devConsole.showingPrevious', { count: previousEntries.length })
            : t('devConsole.showingCurrent', { count: entries.length })}
      </SSText>
      <FlashList
        data={visibleEntries}
        keyExtractor={entryKey}
        renderItem={renderEntry}
        maintainVisibleContentPosition={KEEP_LATEST_VISIBLE}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    borderColor: Colors.gray[600],
    borderRadius: 3,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  buttonDisabled: {
    opacity: 0.35
  },
  panel: {
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    borderBottomColor: Colors.gray[700],
    borderBottomWidth: 1,
    height: '45%',
    left: 0,
    paddingHorizontal: 8,
    paddingTop: 44,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1_000_000
  },
  pill: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderColor: Colors.gray[600],
    borderRadius: 12,
    borderWidth: 1,
    bottom: 40,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    position: 'absolute',
    zIndex: 1_000_000
  },
  status: {
    color: Colors.gray[200],
    paddingVertical: 4
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  }
})
