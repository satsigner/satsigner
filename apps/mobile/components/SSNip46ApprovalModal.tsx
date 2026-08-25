import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { Nip46Request } from '@/types/models/Nostr'
import {
  canAutoApproveRequest,
  getEventPreview,
  getMethodLabel
} from '@/utils/nip46'

import SSButton from './SSButton'
import SSCheckbox from './SSCheckbox'
import SSModal from './SSModal'
import SSText from './SSText'

type SSNip46ApprovalModalProps = {
  onApprove: (requestId: string, alwaysAllow: boolean) => void
  onReject: (requestId: string, alwaysReject: boolean) => void
  request: Nip46Request | null
  visible: boolean
}

export default function SSNip46ApprovalModal({
  onApprove,
  onReject,
  request,
  visible
}: SSNip46ApprovalModalProps) {
  // Default to OFF: a pre-checked "always allow" turns one inattentive tap
  // into a permanent blanket permission for the client.
  const [alwaysAllow, setAlwaysAllow] = useState(false)

  if (!request) {
    return null
  }

  const methodLabel = getMethodLabel(request.method)
  const eventPreview =
    request.method === 'sign_event' ? getEventPreview(request.params) : null
  const thirdPartyPubkey =
    request.method.startsWith('nip04_') || request.method.startsWith('nip44_')
      ? request.params[0]
      : null
  // Requests that must always be approved explicitly do not offer the
  // "always allow" checkbox at all.
  const alwaysAllowAvailable = canAutoApproveRequest(
    request.method,
    request.params
  )

  function handleApprove() {
    setAlwaysAllow(false)
    onApprove(request!.id, alwaysAllow)
  }

  function handleReject() {
    setAlwaysAllow(false)
    onReject(request!.id, false)
  }

  return (
    <SSModal visible={visible} fullOpacity onClose={handleReject}>
      <View style={styles.container}>
        <SSVStack gap="md" widthFull>
          <SSText size="sm" color="muted" uppercase>
            {t('nip46.approval.title')}
          </SSText>

          <SSText size="lg" weight="bold">
            {methodLabel}
          </SSText>

          {eventPreview && (
            <SSVStack gap="xs" style={styles.previewBox}>
              <SSHStack gap="sm">
                <SSText size="xs" color="muted">
                  {t('nip46.approval.eventKind')}:
                </SSText>
                <SSText size="xs">{String(eventPreview.kind)}</SSText>
              </SSHStack>
              <ScrollView style={styles.previewScroll}>
                {eventPreview.content.length > 0 && (
                  <>
                    <SSText size="xs" color="muted">
                      {t('nip46.approval.eventContent')}:
                    </SSText>
                    <SSText size="xs" selectable>
                      {eventPreview.content}
                    </SSText>
                  </>
                )}
                {eventPreview.tags.length > 0 && (
                  <>
                    <SSText size="xs" color="muted">
                      {t('nip46.approval.eventTags')}:
                    </SSText>
                    {eventPreview.tags.map((tag, index) => (
                      <SSText key={index} size="xs" selectable>
                        {JSON.stringify(tag)}
                      </SSText>
                    ))}
                  </>
                )}
              </ScrollView>
            </SSVStack>
          )}

          {thirdPartyPubkey && (
            <SSVStack gap="xs" style={styles.previewBox}>
              <SSText size="xs" color="muted">
                {t('nip46.approval.counterparty')}:
              </SSText>
              <SSText size="xs" selectable>
                {thirdPartyPubkey}
              </SSText>
            </SSVStack>
          )}

          {alwaysAllowAvailable && (
            <SSCheckbox
              selected={alwaysAllow}
              label={t('nip46.approval.alwaysAllow')}
              labelProps={{ size: 'sm' }}
              onPress={() => setAlwaysAllow(!alwaysAllow)}
            />
          )}

          <SSVStack gap="sm" widthFull>
            <SSButton
              label={t('nip46.approval.approve')}
              variant="secondary"
              onPress={handleApprove}
            />
            <SSButton
              label={t('nip46.approval.reject')}
              variant="danger"
              onPress={handleReject}
            />
          </SSVStack>
        </SSVStack>
      </View>
    </SSModal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
    width: '100%'
  },
  previewBox: {
    backgroundColor: Colors.gray[900],
    borderColor: Colors.gray[700],
    borderRadius: 4,
    borderWidth: 1,
    padding: 12
  },
  previewScroll: {
    maxHeight: 220
  }
})
