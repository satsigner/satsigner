import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import { SSIconCheckCircleThin, SSIconWarning } from '@/components/icons'
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
import {
  createThrowawayIdentity,
  sendSecurityReport,
  type ThrowawayIdentity
} from '@/utils/securityReport'

export default function SecurityReport() {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [anonymous, setAnonymous] = useState(true)
  const [sending, setSending] = useState(false)
  const [sentMessage, setSentMessage] = useState<string | null>(null)
  const [backupRevealed, setBackupRevealed] = useState(false)

  // Generated once per visit so the same identity backs both the form's
  // backup offer and the post-send success screen.
  const [throwaway] = useState<ThrowawayIdentity>(() =>
    createThrowawayIdentity()
  )

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === state.activeIdentityNpub && i.nsec)
  )
  const canSendIdentified = Boolean(identity?.nsec)
  const useAnonymous = anonymous || !canSendIdentified

  // Shown upfront so users know exactly where the report is published.
  const publishRelays = useAnonymous
    ? NOSTR_LIVE_CHECK_FALLBACK_RELAYS
    : getNostrContactsRelays(identity?.relays)

  async function handleCopy(text: string) {
    await Clipboard.setStringAsync(text)
    toast.success(t('common.copiedToClipboard'))
  }

  async function handleSend() {
    if (!message.trim()) {
      return
    }
    Keyboard.dismiss()
    setSending(true)
    const reportText = message.trim()
    try {
      await sendSecurityReport({
        message: reportText,
        persistCopy: !useAnonymous,
        relays: publishRelays,
        senderIdentity: useAnonymous
          ? { npub: throwaway.npub, nsec: throwaway.nsec }
          : { npub: identity!.npub, nsec: identity!.nsec! }
      })
      setSentMessage(reportText)
    } catch {
      toast.error(t('settings.about.securityReport.error'))
    } finally {
      setSending(false)
    }
  }

  const backupSection = useAnonymous ? (
    <SSVStack gap="sm" style={styles.backupBox}>
      <SSText uppercase size="xs" color="muted">
        {t('settings.about.securityReport.throwawayTitle')}
      </SSText>
      <SSText size="xs" color="muted">
        {t('settings.about.securityReport.throwawayDescription')}
      </SSText>
      <SSButton
        label={
          backupRevealed
            ? t('settings.about.securityReport.hideBackup')
            : t('settings.about.securityReport.showBackup')
        }
        variant="outline"
        onPress={() => setBackupRevealed((v) => !v)}
      />
      {backupRevealed ? (
        <SSVStack gap="sm">
          <SSText uppercase size="xs" color="muted">
            {t('settings.about.securityReport.seedWords')}
          </SSText>
          <Pressable onPress={() => handleCopy(throwaway.mnemonic)}>
            <SSText size="sm" type="mono" style={styles.secretText}>
              {throwaway.mnemonic}
            </SSText>
          </Pressable>
          <SSText uppercase size="xs" color="muted">
            {t('settings.about.securityReport.nsecKey')}
          </SSText>
          <Pressable onPress={() => handleCopy(throwaway.nsec)}>
            <SSText size="sm" type="mono" style={styles.secretText}>
              {throwaway.nsec}
            </SSText>
          </Pressable>
          <SSText size="xs" color="muted">
            {t('settings.about.securityReport.tapToCopy')}
          </SSText>
        </SSVStack>
      ) : null}
    </SSVStack>
  ) : null

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
        {sentMessage !== null ? (
          <SSVStack gap="lg" style={styles.successContainer}>
            <SSVStack gap="md" itemsCenter>
              <SSIconCheckCircleThin height={48} width={48} />
              <SSText size="lg" weight="medium" center>
                {t('settings.about.securityReport.sentTitle')}
              </SSText>
              <SSText color="muted" size="sm" center>
                {t('settings.about.securityReport.sentDescription')}
              </SSText>
            </SSVStack>
            <View style={styles.sentBox}>
              <ScrollView style={styles.sentScroll}>
                <SSText size="sm">{sentMessage}</SSText>
              </ScrollView>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {backupSection}
            </ScrollView>
            <SSButton
              label={t('common.close')}
              variant="secondary"
              onPress={() => router.back()}
            />
          </SSVStack>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
                  selected={useAnonymous}
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

              {backupSection}

              <SSVStack gap="xs">
                <SSText uppercase size="xs" color="muted">
                  {t('settings.about.securityReport.relaysTitle')}
                </SSText>
                {publishRelays.map((relay) => (
                  <SSText key={relay} size="xs" color="muted" type="mono">
                    {relay}
                  </SSText>
                ))}
              </SSVStack>

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
          </ScrollView>
        )}
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  anonRow: { alignItems: 'center' },
  anonText: { flex: 1 },
  backupBox: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    padding: 12
  },
  input: { minHeight: 140, textAlignVertical: 'top' },
  secretText: {
    color: Colors.white
  },
  sentBox: {
    backgroundColor: Colors.gray[900],
    borderRadius: 8,
    maxHeight: 320,
    padding: 12
  },
  sentScroll: {
    flexGrow: 0
  },
  successContainer: {
    paddingTop: 32
  },
  warningRow: { alignItems: 'center' },
  warningText: { color: Colors.warning, flex: 1 }
})
