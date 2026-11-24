import { useState } from 'react'
import { StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { NOSTR_CHAT_SESSION_TITLE_MAX } from '@/constants/nostr'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

type SSChatSessionMenuProps = {
  visible: boolean
  title?: string
  isDefault: boolean
  deleting: boolean
  onClose: () => void
  onStartNew: (title?: string) => void
  onRename: (title: string) => void
  onArchive: () => void
  onDelete: (everywhere: boolean) => void
}

type MenuStep = 'actions' | 'delete' | 'new' | 'rename'

/** Thread menu for NIP-17 sessions: start, rename, archive or delete one. */
function SSChatSessionMenu({
  visible,
  title,
  isDefault,
  deleting,
  onClose,
  onStartNew,
  onRename,
  onArchive,
  onDelete
}: SSChatSessionMenuProps) {
  const [step, setStep] = useState<MenuStep>('actions')
  const [draft, setDraft] = useState('')

  function close() {
    setStep('actions')
    setDraft('')
    onClose()
  }

  function openNew() {
    setDraft('')
    setStep('new')
  }

  function openRename() {
    setDraft(title ?? '')
    setStep('rename')
  }

  function openDelete() {
    setStep('delete')
  }

  function confirmNew() {
    const named = draft.trim()
    close()
    onStartNew(named.length > 0 ? named : undefined)
  }

  function confirmRename() {
    close()
    onRename(draft)
  }

  function confirmArchive() {
    close()
    onArchive()
  }

  function deleteHere() {
    close()
    onDelete(false)
  }

  function deleteEverywhere() {
    close()
    onDelete(true)
  }

  return (
    <SSModal visible={visible} onClose={close}>
      <SSVStack gap="sm" style={styles.menu}>
        {step === 'actions' ? (
          <>
            <SSText center color="muted" numberOfLines={2}>
              {title ?? t('nostrIdentity.chat.sessions.defaultTitle')}
            </SSText>
            <SSButton
              label={t('nostrIdentity.chat.sessions.new')}
              onPress={openNew}
            />
            <SSButton
              label={t('nostrIdentity.chat.sessions.rename')}
              onPress={openRename}
              variant="outline"
            />
            <SSButton
              label={t('nostrIdentity.chat.sessions.archive')}
              onPress={confirmArchive}
              variant="outline"
            />
            {isDefault ? null : (
              <SSButton
                label={t('nostrIdentity.chat.sessions.delete')}
                onPress={openDelete}
                variant="danger"
                loading={deleting}
              />
            )}
          </>
        ) : null}
        {step === 'new' || step === 'rename' ? (
          <>
            <SSText center color="muted">
              {step === 'new'
                ? t('nostrIdentity.chat.sessions.newHint')
                : t('nostrIdentity.chat.sessions.renameHint')}
            </SSText>
            <SSTextInput
              value={draft}
              onChangeText={setDraft}
              maxLength={NOSTR_CHAT_SESSION_TITLE_MAX}
              placeholder={t('nostrIdentity.chat.sessions.titlePlaceholder')}
              autoFocus
            />
            <SSButton
              label={
                step === 'new'
                  ? t('nostrIdentity.chat.sessions.start')
                  : t('nostrIdentity.chat.sessions.save')
              }
              onPress={step === 'new' ? confirmNew : confirmRename}
            />
          </>
        ) : null}
        {step === 'delete' ? (
          <>
            <SSText center color="muted">
              {t('nostrIdentity.chat.sessions.deleteWarning')}
            </SSText>
            <SSButton
              label={t('nostrIdentity.chat.sessions.deleteHere')}
              onPress={deleteHere}
              variant="outline"
            />
            <SSButton
              label={t('nostrIdentity.chat.sessions.deleteEverywhere')}
              onPress={deleteEverywhere}
              variant="danger"
            />
          </>
        ) : null}
      </SSVStack>
    </SSModal>
  )
}

const styles = StyleSheet.create({
  menu: {
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'center'
  }
})

export default SSChatSessionMenu
