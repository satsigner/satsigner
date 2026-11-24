import { useState } from 'react'
import { StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import {
  NOSTR_CHAT_SESSION_TITLE_MAX,
  NOSTR_PRIVACY_MASK
} from '@/constants/nostr'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import type { NostrChatSession } from '@/types/models/Nostr'

type SSChatSessionMenuProps = {
  visible: boolean
  title?: string
  isDefault: boolean
  /** Masks titles; renaming then starts from an empty draft. */
  privacyMode: boolean
  /** Without a signing key, only local deletion is offered. */
  canDeleteEverywhere: boolean
  deleting: boolean
  archivedSessions: NostrChatSession[]
  onClose: () => void
  onStartNew: (title?: string) => void
  onRename: (title: string) => void
  onArchive: () => void
  onRestore: (sessionId: string) => void
  /** The parent closes the menu once deletion is done. */
  onDelete: (everywhere: boolean) => void
}

type MenuStep = 'actions' | 'archived' | 'delete' | 'new' | 'rename'

function ArchivedSessionRow({
  session,
  privacyMode,
  onRestore
}: {
  session: NostrChatSession
  privacyMode: boolean
  onRestore: (sessionId: string) => void
}) {
  function restore() {
    onRestore(session.sessionId)
  }
  const title = session.title ?? t('nostrIdentity.chat.sessions.untitled')
  return (
    <SSButton
      label={t('nostrIdentity.chat.sessions.restoreNamed', {
        title: privacyMode ? NOSTR_PRIVACY_MASK : title
      })}
      onPress={restore}
      variant="outline"
    />
  )
}

/** Thread menu for NIP-17 sessions: start, rename, archive or delete one. */
function SSChatSessionMenu({
  visible,
  title,
  isDefault,
  privacyMode,
  canDeleteEverywhere,
  deleting,
  archivedSessions,
  onClose,
  onStartNew,
  onRename,
  onArchive,
  onRestore,
  onDelete
}: SSChatSessionMenuProps) {
  const [step, setStep] = useState<MenuStep>('actions')
  const [draft, setDraft] = useState('')
  const shownTitle = title ?? t('nostrIdentity.chat.sessions.defaultTitle')

  function close() {
    if (deleting) {
      return
    }
    setStep('actions')
    setDraft('')
    onClose()
  }

  function openNew() {
    setDraft('')
    setStep('new')
  }

  function openRename() {
    setDraft(privacyMode ? '' : (title ?? ''))
    setStep('rename')
  }

  function openDelete() {
    setStep('delete')
  }

  function openArchived() {
    setStep('archived')
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

  function restore(sessionId: string) {
    close()
    onRestore(sessionId)
  }

  function deleteHere() {
    onDelete(false)
  }

  function deleteEverywhere() {
    onDelete(true)
  }

  return (
    <SSModal visible={visible} onClose={close}>
      <SSVStack gap="sm" style={styles.menu}>
        {step === 'actions' ? (
          <>
            <SSText center color="muted" numberOfLines={2}>
              {privacyMode ? NOSTR_PRIVACY_MASK : shownTitle}
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
            {archivedSessions.length > 0 ? (
              <SSButton
                label={t('nostrIdentity.chat.sessions.archived', {
                  count: archivedSessions.length
                })}
                onPress={openArchived}
                variant="outline"
              />
            ) : null}
            {isDefault ? null : (
              <SSButton
                label={t('nostrIdentity.chat.sessions.delete')}
                onPress={openDelete}
                variant="danger"
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
        {step === 'archived'
          ? archivedSessions.map((session) => (
              <ArchivedSessionRow
                key={session.sessionId}
                session={session}
                privacyMode={privacyMode}
                onRestore={restore}
              />
            ))
          : null}
        {step === 'delete' ? (
          <>
            <SSText center color="muted">
              {canDeleteEverywhere
                ? t('nostrIdentity.chat.sessions.deleteWarning')
                : t('nostrIdentity.chat.sessions.deleteLocalWarning')}
            </SSText>
            <SSButton
              label={t('nostrIdentity.chat.sessions.deleteHere')}
              onPress={deleteHere}
              variant="outline"
              disabled={deleting}
            />
            {canDeleteEverywhere ? (
              <SSButton
                label={t('nostrIdentity.chat.sessions.deleteEverywhere')}
                onPress={deleteEverywhere}
                variant="danger"
                loading={deleting}
              />
            ) : null}
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
