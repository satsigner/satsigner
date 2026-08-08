import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet } from 'react-native'
import { toast } from 'sonner-native'

import { SSIconWarning } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { NOSTR_LIVE_CHECK_FALLBACK_RELAYS } from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import { getNostrContactsRelays } from '@/utils/nostrContacts'
import { sendSecurityReport } from '@/utils/securityReport'

export default function SecurityReport() {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [anonymous, setAnonymous] = useState(true)
  const [sending, setSending] = useState(false)

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === state.activeIdentityNpub && i.nsec)
  )
  const canSendIdentified = Boolean(identity?.nsec)

  async function handleSend() {
    if (!message.trim()) {
      return
    }
    setSending(true)
    try {
      const useAnonymous = anonymous || !canSendIdentified
      const relays = useAnonymous
        ? NOSTR_LIVE_CHECK_FALLBACK_RELAYS
        : getNostrContactsRelays(identity?.relays)
      await sendSecurityReport({
        identity: useAnonymous
          ? undefined
          : { npub: identity!.npub, nsec: identity!.nsec! },
        message,
        relays
      })
      toast.success(t('settings.about.securityReport.success'))
      router.back()
    } catch {
      toast.error(t('settings.about.securityReport.error'))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: undefined,
          headerTitle: () => (
            <SSText uppercase>{t('settings.about.securityReport.title')}</SSText>
          )
        }}
      />
      <SSMainLayout>
        <SSVStack gap="lg">
          <SSHStack gap="sm" style={styles.warningRow}>
            <SSIconWarning height={20} width={20} />
            <SSText size="sm" style={styles.warningText}>
              {t('settings.about.securityReport.warning')}
            </SSText>
          </SSHStack>

          <SSText color="muted" size="sm">
            {t('settings.about.securityReport.description')}
          </SSText>

          <SSTextInput
            value={message}
            onChangeText={setMessage}
            placeholder={t('settings.about.securityReport.placeholder')}
            align="left"
            multiline
            style={styles.input}
          />

          <SSHStack gap="sm" style={styles.anonRow}>
            <SSCheckbox
              selected={anonymous || !canSendIdentified}
              onPress={() => setAnonymous((v) => !v)}
            />
            <SSVStack gap="xxs" style={styles.anonText}>
              <SSText size="sm">
                {t('settings.about.securityReport.anonymous')}
              </SSText>
              <SSText size="xs" color="muted">
                {canSendIdentified
                  ? t('settings.about.securityReport.anonymousHint')
                  : t('settings.about.securityReport.anonymousOnly')}
              </SSText>
            </SSVStack>
          </SSHStack>

          <SSButton
            label={t('settings.about.securityReport.send')}
            variant="secondary"
            loading={sending}
            disabled={sending || !message.trim()}
            onPress={handleSend}
          />
          <SSButton
            label={t('common.back')}
            variant="ghost"
            onPress={router.back}
          />
        </SSVStack>
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  anonRow: { alignItems: 'center' as const },
  anonText: { flex: 1 },
  input: { minHeight: 140, textAlignVertical: 'top' as const },
  warningRow: { alignItems: 'center' },
  warningText: { color: Colors.warning, flex: 1 }
})
