import { Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSDevConsolePanel, {
  type DevConsolePanelActions,
  PANEL_EDGE_GAP
} from '@/components/SSDevConsolePanel'
import SSText from '@/components/SSText'
import { t } from '@/locales'
import { useDevConsoleStore } from '@/store/devConsole'
import { Colors } from '@/styles'
import {
  clearDevConsole,
  closeDevConsole,
  copyDevConsoleEntries,
  hideDevConsole,
  openDevConsole,
  pauseDevSteps,
  releaseNextDevStep,
  resumeDevSteps,
  toggleDevConsoleDock,
  toggleDevConsoleSession
} from '@/utils/devConsole'

async function handleCopy() {
  const copied = await copyDevConsoleEntries()
  if (copied) {
    toast.success(t('devConsole.copied'))
    return
  }
  toast.error(t('devConsole.copyFailed'))
}

const PANEL_ACTIONS: DevConsolePanelActions = {
  onClear: clearDevConsole,
  onClose: closeDevConsole,
  onCopy: handleCopy,
  onHide: hideDevConsole,
  onNextStep: releaseNextDevStep,
  onPause: pauseDevSteps,
  onResume: resumeDevSteps,
  onToggleDock: toggleDevConsoleDock,
  onToggleSession: toggleDevConsoleSession
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
        <SSText size="xxs" type="mono" uppercase style={styles.pillText}>
          {pausedSteps.length > 0
            ? t('devConsole.pillPaused', { count: entries.length })
            : t('devConsole.pill', { count: entries.length })}
        </SSText>
      </Pressable>
    )
  }

  const dockStyle =
    dock === 'top'
      ? { paddingTop: insets.top + PANEL_EDGE_GAP, top: 0 }
      : { bottom: 0, paddingBottom: insets.bottom + PANEL_EDGE_GAP }

  return (
    <SSDevConsolePanel
      actions={PANEL_ACTIONS}
      dock={dock}
      entries={showPrevious ? previousEntries : entries}
      pausedSteps={pausedSteps}
      showPrevious={showPrevious}
      stepMode={stepMode}
      style={[styles.floating, dockStyle]}
    />
  )
}

const styles = StyleSheet.create({
  floating: {
    height: '55%',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 1_000_000
  },
  pill: {
    backgroundColor: Colors.gray[850],
    borderRadius: 14,
    justifyContent: 'center',
    left: 12,
    minHeight: 28,
    paddingHorizontal: 12,
    position: 'absolute',
    zIndex: 1_000_000
  },
  pillText: {
    color: Colors.gray[75]
  }
})
