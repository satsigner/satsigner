import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { DEFAULT_FIAT_PRICE_API_URL } from '@/constants/fiatPriceApi'
import {
  PAYJOIN_DEFAULT_COORDINATION_MODE,
  PAYJOIN_SESSION_TTL_MS
} from '@/constants/payjoin'
import mmkvStorage from '@/storage/mmkv'
import { type WordListName, DEFAULT_WORD_LIST } from '@/types/bips/39'
import { type AutoSelectUtxosAlgorithm } from '@/types/models/AutoSelectUtxos'
import { type BrantaLookupMode } from '@/types/models/Branta'
import {
  type PayjoinCoordinationMode,
  type PayjoinSettings
} from '@/types/payjoin'
import { normalizeFiatPriceApiUrl } from '@/utils/fiat'
import { isRecord } from '@/utils/object'
import {
  hasCustomPayjoinDirectoryUrl,
  normalizePayjoinCoordinationMode,
  resolvePayjoinDirectoryUrl
} from '@/utils/payjoinMode'
import { normalizePayjoinSessionTtlMs } from '@/utils/payjoinTtl'

type FiatPriceProvider = 'custom' | 'mempool'

type SettingsState = {
  /** When true, clearnet payee logos load without asking again. Off by default. */
  brantaClearnetLogoAllowed: boolean
  /** When true, payee names are written into transaction, output, and change labels. */
  brantaLabelSyncEnabled: boolean
  /** Off until the user picks a lookup mode. */
  brantaLookupMode: BrantaLookupMode
  /** When true, the third-party lookup warning is skipped. Off by default. */
  brantaLookupWarningDismissed: boolean
  /** When true, Branta lookups use Orbot and do not use the clearnet. */
  brantaTorEnabled: boolean
  mnemonicWordList: WordListName
  useZeroPadding: boolean
  currencyUnit: 'sats' | 'btc'
  showWarning: boolean
  skipSeedConfirmation: boolean
  privacyMode: boolean
  /** When true, Payjoin coordination is available at all (master kill switch). */
  payjoinEnabled: boolean
  /** Directory (network) vs Manual (offline out-of-band) coordination. */
  payjoinCoordinationMode: PayjoinCoordinationMode
  /** Custom Payjoin directory URL (Directory mode only); empty uses the default. */
  payjoinDirectoryUrl: string
  /** Receiver/sender session TTL in ms (1 / 5 / 10 minute presets). */
  payjoinSessionTtlMs: number
  fetchCurrentPrices: boolean
  fetchHistoricalPrices: boolean
  fetchHistoricalPricesFromNetwork: boolean
  fiatPriceApiUrl: string
  fiatPriceProvider: FiatPriceProvider
  defaultAutoSelectUtxos: AutoSelectUtxosAlgorithm
}

type SettingsAction = {
  setBrantaClearnetLogoAllowed: (
    brantaClearnetLogoAllowed: SettingsState['brantaClearnetLogoAllowed']
  ) => void
  setBrantaLabelSyncEnabled: (
    brantaLabelSyncEnabled: SettingsState['brantaLabelSyncEnabled']
  ) => void
  setBrantaLookupMode: (
    brantaLookupMode: SettingsState['brantaLookupMode']
  ) => void
  setBrantaLookupWarningDismissed: (
    brantaLookupWarningDismissed: SettingsState['brantaLookupWarningDismissed']
  ) => void
  setBrantaTorEnabled: (
    brantaTorEnabled: SettingsState['brantaTorEnabled']
  ) => void
  setCurrencyUnit: (currencyUnit: SettingsState['currencyUnit']) => void
  setUseZeroPadding: (useZeroPadding: SettingsState['useZeroPadding']) => void
  setShowWarning: (showWarning: SettingsState['showWarning']) => void
  setSkipSeedConfirmation: (skip: SettingsState['skipSeedConfirmation']) => void
  setMnemonicWordList: (wordList: SettingsState['mnemonicWordList']) => void
  setFetchCurrentPrices: (
    fetchCurrentPrices: SettingsState['fetchCurrentPrices']
  ) => void
  setFetchHistoricalPrices: (
    fetchHistoricalPrices: SettingsState['fetchHistoricalPrices']
  ) => void
  setFetchHistoricalPricesFromNetwork: (
    fetchHistoricalPricesFromNetwork: SettingsState['fetchHistoricalPricesFromNetwork']
  ) => void
  setFiatPriceApiUrl: (
    fiatPriceApiUrl: SettingsState['fiatPriceApiUrl']
  ) => void
  setFiatPriceProvider: (
    fiatPriceProvider: SettingsState['fiatPriceProvider']
  ) => void
  setDefaultAutoSelectUtxos: (
    algorithm: SettingsState['defaultAutoSelectUtxos']
  ) => void
  setPayjoinEnabled: (payjoinEnabled: SettingsState['payjoinEnabled']) => void
  setPayjoinCoordinationMode: (
    payjoinCoordinationMode: SettingsState['payjoinCoordinationMode']
  ) => void
  setPayjoinDirectoryUrl: (
    payjoinDirectoryUrl: SettingsState['payjoinDirectoryUrl']
  ) => void
  setPayjoinSessionTtlMs: (
    payjoinSessionTtlMs: SettingsState['payjoinSessionTtlMs']
  ) => void
  togglePrivacyMode: () => void
}

function migrateFiatPriceSettings(
  persisted: Record<string, unknown> | undefined,
  merged: SettingsState & SettingsAction
) {
  if (!persisted || 'fiatPriceProvider' in persisted) {
    return merged
  }

  const legacyUrl = normalizeFiatPriceApiUrl(
    typeof persisted.fiatPriceApiUrl === 'string'
      ? persisted.fiatPriceApiUrl
      : ''
  )

  if (legacyUrl && legacyUrl !== DEFAULT_FIAT_PRICE_API_URL) {
    merged.fiatPriceProvider = 'custom'
    merged.fiatPriceApiUrl = legacyUrl
  } else {
    merged.fiatPriceProvider = 'mempool'
    merged.fiatPriceApiUrl = ''
  }

  return merged
}

const useSettingsStore = create<SettingsState & SettingsAction>()(
  persist(
    (set) => ({
      brantaClearnetLogoAllowed: false,
      brantaLabelSyncEnabled: false,
      brantaLookupMode: 'off',
      brantaLookupWarningDismissed: false,
      brantaTorEnabled: false,
      currencyUnit: 'sats',
      defaultAutoSelectUtxos: 'privacy',
      fetchCurrentPrices: true,
      fetchHistoricalPrices: false,
      fetchHistoricalPricesFromNetwork: false,
      fiatPriceApiUrl: '',
      fiatPriceProvider: 'mempool',
      mnemonicWordList: DEFAULT_WORD_LIST,
      payjoinCoordinationMode: PAYJOIN_DEFAULT_COORDINATION_MODE,
      payjoinDirectoryUrl: '',
      payjoinEnabled: true,
      payjoinSessionTtlMs: PAYJOIN_SESSION_TTL_MS,
      privacyMode: false,
      setBrantaClearnetLogoAllowed: (brantaClearnetLogoAllowed) => {
        set({ brantaClearnetLogoAllowed })
      },
      setBrantaLabelSyncEnabled: (brantaLabelSyncEnabled) => {
        set({ brantaLabelSyncEnabled })
      },
      setBrantaLookupMode: (brantaLookupMode) => {
        set({ brantaLookupMode })
      },
      setBrantaLookupWarningDismissed: (brantaLookupWarningDismissed) => {
        set({ brantaLookupWarningDismissed })
      },
      setBrantaTorEnabled: (brantaTorEnabled) => {
        set({ brantaTorEnabled })
      },
      setCurrencyUnit: (currencyUnit) => {
        set({ currencyUnit })
      },
      setDefaultAutoSelectUtxos: (defaultAutoSelectUtxos) => {
        set({ defaultAutoSelectUtxos })
      },
      setFetchCurrentPrices: (fetchCurrentPrices) => {
        set({ fetchCurrentPrices })
      },
      setFetchHistoricalPrices: (fetchHistoricalPrices) => {
        set(
          fetchHistoricalPrices
            ? { fetchHistoricalPrices }
            : {
                fetchHistoricalPrices: false,
                fetchHistoricalPricesFromNetwork: false
              }
        )
      },
      setFetchHistoricalPricesFromNetwork: (
        fetchHistoricalPricesFromNetwork
      ) => {
        set({ fetchHistoricalPricesFromNetwork })
      },
      setFiatPriceApiUrl: (fiatPriceApiUrl) => {
        set({ fiatPriceApiUrl: normalizeFiatPriceApiUrl(fiatPriceApiUrl) })
      },
      setFiatPriceProvider: (fiatPriceProvider) => {
        set({ fiatPriceProvider })
      },
      setMnemonicWordList: (mnemonicWordList) => {
        set({ mnemonicWordList })
      },
      setPayjoinCoordinationMode: (payjoinCoordinationMode) => {
        set({
          payjoinCoordinationMode: normalizePayjoinCoordinationMode(
            payjoinCoordinationMode
          )
        })
      },
      setPayjoinDirectoryUrl: (payjoinDirectoryUrl) => {
        set({ payjoinDirectoryUrl: payjoinDirectoryUrl.trim() })
      },
      setPayjoinEnabled: (payjoinEnabled) => {
        set({ payjoinEnabled })
      },
      setPayjoinSessionTtlMs: (payjoinSessionTtlMs) => {
        set({
          payjoinSessionTtlMs: normalizePayjoinSessionTtlMs(payjoinSessionTtlMs)
        })
      },
      setShowWarning: (showWarning) => {
        set({ showWarning })
      },
      setSkipSeedConfirmation: (skipSeedConfirmation) => {
        set({ skipSeedConfirmation })
      },
      setUseZeroPadding: (useZeroPadding) => {
        set({ useZeroPadding })
      },
      showWarning: true,
      skipSeedConfirmation: true,
      togglePrivacyMode: () =>
        set((state) => ({ privacyMode: !state.privacyMode })),
      useZeroPadding: false
    }),
    {
      merge: (persistedState, currentState) => {
        const persisted = isRecord(persistedState) ? persistedState : undefined
        const merged = migrateFiatPriceSettings(persisted, {
          ...currentState,
          ...persisted
        })
        merged.payjoinSessionTtlMs = normalizePayjoinSessionTtlMs(
          merged.payjoinSessionTtlMs
        )
        merged.payjoinCoordinationMode = normalizePayjoinCoordinationMode(
          merged.payjoinCoordinationMode
        )
        if (
          persisted?.brantaLookupEnabled === true ||
          persisted?.brantaLookupMode === 'ask'
        ) {
          merged.brantaLookupMode = 'always'
        }
        return merged
      },
      name: 'settings-store',
      storage: createJSONStorage(() => mmkvStorage)
    }
  )
)

export { migrateFiatPriceSettings, useSettingsStore }

/** Current payjoin settings, read once, for `PayjoinDeps`. */
function getPayjoinSettings(): PayjoinSettings {
  const { payjoinDirectoryUrl, payjoinSessionTtlMs } =
    useSettingsStore.getState()
  return {
    directoryUrl: resolvePayjoinDirectoryUrl(payjoinDirectoryUrl),
    hasCustomDirectory: hasCustomPayjoinDirectoryUrl(payjoinDirectoryUrl),
    sessionTtlMs: normalizePayjoinSessionTtlMs(payjoinSessionTtlMs)
  }
}

function getFiatPriceApiUrl() {
  const { fiatPriceApiUrl, fiatPriceProvider } = useSettingsStore.getState()
  if (fiatPriceProvider !== 'custom') {
    return DEFAULT_FIAT_PRICE_API_URL
  }
  return normalizeFiatPriceApiUrl(fiatPriceApiUrl) || DEFAULT_FIAT_PRICE_API_URL
}

export { getFiatPriceApiUrl, getPayjoinSettings }
