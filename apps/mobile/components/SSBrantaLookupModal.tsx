import { useSyncExternalStore } from 'react'

import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import {
  answerBrantaLookup,
  brantaLookupGateOpen,
  subscribeBrantaLookupGate
} from '@/utils/brantaLookupGate'

import SSButton from './SSButton'
import SSModal from './SSModal'
import SSText from './SSText'

function cancelLookup() {
  answerBrantaLookup(false)
}

function allowLookupOnce() {
  answerBrantaLookup(true)
}

function allowLookupWithoutWarning() {
  useSettingsStore.getState().setBrantaLookupWarningDismissed(true)
  answerBrantaLookup(true)
}

function SSBrantaLookupModal() {
  const open = useSyncExternalStore(
    subscribeBrantaLookupGate,
    brantaLookupGateOpen,
    brantaLookupGateOpen
  )
  const torEnabled = useSettingsStore((state) => state.brantaTorEnabled)

  return (
    <SSModal visible={open} showLabel={false} onClose={cancelLookup}>
      <SSVStack gap="md">
        <SSText uppercase weight="medium">
          {t('settings.branta.lookupTitle')}
        </SSText>
        <SSText color="muted">
          {torEnabled
            ? t('settings.branta.lookupWarningTor')
            : t('settings.branta.lookupWarningClearnet')}
        </SSText>
        <SSButton
          label={t('settings.branta.lookupCancel')}
          variant="ghost"
          onPress={cancelLookup}
        />
        <SSButton
          label={t('settings.branta.lookupOk')}
          variant="outline"
          onPress={allowLookupOnce}
        />
        <SSButton
          label={t('settings.branta.lookupAlways')}
          variant="outline"
          onPress={allowLookupWithoutWarning}
        />
      </SSVStack>
    </SSModal>
  )
}

export default SSBrantaLookupModal
