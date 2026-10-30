import { useSettingsStore } from '@/store/settings'
import { askBrantaLookup } from '@/utils/brantaLookupGate'

function brantaSettings() {
  return useSettingsStore.getState()
}

function confirmAutomaticBrantaLookup() {
  const { brantaLookupMode, brantaLookupWarningDismissed } = brantaSettings()
  if (brantaLookupMode !== 'always') {
    return false
  }
  if (brantaLookupWarningDismissed) {
    return true
  }
  return askBrantaLookup()
}

function confirmRequestedBrantaLookup() {
  const { brantaLookupMode, brantaLookupWarningDismissed } = brantaSettings()
  if (brantaLookupMode === 'off') {
    return false
  }
  if (brantaLookupWarningDismissed) {
    return true
  }
  return askBrantaLookup()
}

function useBrantaLookupConsent() {
  const mode = useSettingsStore((state) => state.brantaLookupMode)

  return {
    confirmAutomaticBrantaLookup,
    confirmRequestedBrantaLookup,
    mode
  }
}

export { confirmAutomaticBrantaLookup, useBrantaLookupConsent }
