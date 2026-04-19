import { Stack, useLocalSearchParams } from 'expo-router'
import { useRef, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSModal from '@/components/SSModal'
import SSNip46ApprovalModal from '@/components/SSNip46ApprovalModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useNip46Connect } from '@/hooks/useNip46Connect'
import { useNip46SessionManager } from '@/hooks/useNip46SessionManager'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNip46Store } from '@/store/nip46'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import type { DetectedContent } from '@/utils/contentDetector'

type BunkerParams = {
  connectUri?: string
  npub: string
}

export default function NostrBunker() {
  const { connectUri, npub } = useLocalSearchParams<BunkerParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )

  const sessions = useNip46Store((s) =>
    s.sessions.filter((session) => session.signerNpub === npub)
  )
  const pendingRequests = useNip46Store((s) => s.pendingRequests)
  const removeSession = useNip46Store((s) => s.removeSession)

  const { approveRequest, isSessionActive, rejectRequest, stopSession } =
    useNip46SessionManager()
  const { error, initiateConnection, isConnecting } = useNip46Connect(
    npub,
    identity?.nsec ?? ''
  )

  const autoConnectRef = useRef(false)
  if (connectUri && !autoConnectRef.current && !isConnecting) {
    autoConnectRef.current = true
    void handleConnect(connectUri)
  }

  const [cameraVisible, setCameraVisible] = useState(false)
  const [pasteModalVisible, setPasteModalVisible] = useState(false)
  const [pasteInput, setPasteInput] = useState('')
  const [disconnectSessionId, setDisconnectSessionId] = useState<string | null>(
    null
  )

  const currentRequest =
    pendingRequests.find((r) => sessions.some((s) => s.id === r.sessionId)) ??
    null

  async function handleConnect(uri: string) {
    const session = await initiateConnection(uri)
    if (session) {
      toast.success(
        t('nip46.connectionSuccess', { name: session.clientName ?? 'App' })
      )
    }
  }

  function handleContentScanned(content: DetectedContent) {
    setCameraVisible(false)
    if (content.type === 'nostr_connect') {
      void handleConnect(content.cleaned)
    }
  }

  function handlePasteSubmit() {
    setPasteModalVisible(false)
    const uri = pasteInput.trim()
    setPasteInput('')
    if (uri) {
      void handleConnect(uri)
    }
  }

  function handleDisconnect(sessionId: string) {
    stopSession(sessionId)
    removeSession(sessionId)
    setDisconnectSessionId(null)
    toast.success(t('nip46.disconnected'))
  }

  function handleApproveRequest(requestId: string, alwaysAllow: boolean) {
    void approveRequest(requestId, alwaysAllow)
    toast.success(t('nip46.requestApproved'))
  }

  function handleRejectRequest(requestId: string, alwaysReject: boolean) {
    void rejectRequest(requestId, alwaysReject)
    toast.success(t('nip46.requestRejected'))
  }

  if (!identity) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.emptyContainer}>
          <SSText color="muted">{t('nostrIdentity.account.notFound')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{t('nip46.title')}</SSText>
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SSVStack gap="lg" style={styles.content}>
          <SSVStack gap="sm">
            <SSButton
              label={t('nip46.scanConnection')}
              variant="secondary"
              onPress={() => setCameraVisible(true)}
              loading={isConnecting}
            />
            <SSButton
              label={t('nip46.pasteConnection')}
              variant="outline"
              onPress={() => setPasteModalVisible(true)}
            />
          </SSVStack>

          {error && (
            <SSText color="muted" size="sm">
              {error}
            </SSText>
          )}

          <SSVStack gap="sm">
            <SSText size="sm" color="muted" uppercase>
              {t('nip46.sessions')}
            </SSText>

            {sessions.length === 0 ? (
              <SSVStack itemsCenter gap="sm" style={styles.emptyContainer}>
                <SSText color="muted">{t('nip46.noSessions')}</SSText>
                <SSText color="muted" size="xs" center>
                  {t('nip46.noSessionsDescription')}
                </SSText>
              </SSVStack>
            ) : (
              sessions.map((session) => (
                <View key={session.id} style={styles.sessionCard}>
                  <SSVStack gap="xs">
                    <SSHStack justifyBetween>
                      <SSText weight="bold">
                        {session.clientName ?? 'Unknown App'}
                      </SSText>
                      <SSText
                        size="xs"
                        color={isSessionActive(session.id) ? 'white' : 'muted'}
                      >
                        {isSessionActive(session.id)
                          ? t('nip46.connected')
                          : t('nip46.disconnected')}
                      </SSText>
                    </SSHStack>

                    <SSText size="xs" color="muted">
                      {session.relays.length}{' '}
                      {session.relays.length === 1 ? 'relay' : 'relays'}
                    </SSText>

                    <SSText size="xs" color="muted">
                      {t('nip46.lastActive')}:{' '}
                      {new Date(session.lastActiveAt).toLocaleString()}
                    </SSText>

                    <SSButton
                      label={t('nip46.disconnect')}
                      variant="danger"
                      onPress={() => setDisconnectSessionId(session.id)}
                    />
                  </SSVStack>
                </View>
              ))
            )}
          </SSVStack>
        </SSVStack>
      </ScrollView>

      <SSCameraModal
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onContentScanned={handleContentScanned}
        context="nostr"
        title={t('nip46.scanConnection')}
      />

      <SSModal
        visible={pasteModalVisible}
        fullOpacity
        onClose={() => {
          setPasteModalVisible(false)
          setPasteInput('')
        }}
      >
        <View style={styles.pasteContainer}>
          <SSVStack gap="md" widthFull>
            <SSText size="sm" color="muted" uppercase>
              {t('nip46.pasteConnection')}
            </SSText>
            <SSTextInput
              placeholder="nostrconnect://..."
              value={pasteInput}
              onChangeText={setPasteInput}
              align="left"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <SSButton
              label={t('nip46.approval.approve')}
              variant="secondary"
              onPress={handlePasteSubmit}
              disabled={pasteInput.trim().length === 0}
            />
          </SSVStack>
        </View>
      </SSModal>

      <SSModal
        visible={disconnectSessionId !== null}
        fullOpacity
        label={t('common.cancel')}
        onClose={() => setDisconnectSessionId(null)}
      >
        <View style={styles.disconnectContainer}>
          <SSVStack gap="md" itemsCenter widthFull>
            <SSText center color="muted" size="sm">
              {t('nip46.disconnectConfirm')}
            </SSText>
            <SSButton
              label={t('nip46.disconnect')}
              variant="danger"
              onPress={() => {
                if (disconnectSessionId) {
                  handleDisconnect(disconnectSessionId)
                }
              }}
            />
          </SSVStack>
        </View>
      </SSModal>

      <SSNip46ApprovalModal
        visible={currentRequest !== null}
        request={currentRequest}
        onApprove={handleApproveRequest}
        onReject={handleRejectRequest}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 40
  },
  disconnectContainer: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
    width: '100%'
  },
  emptyContainer: {
    paddingVertical: 40
  },
  pasteContainer: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
    width: '100%'
  },
  sessionCard: {
    borderColor: Colors.gray[800],
    borderRadius: 4,
    borderWidth: 1,
    padding: 12
  }
})
