import { useState } from 'react'
import { StyleSheet, Switch, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { Nip46Request } from '@/types/models/Nip46'

import SSButton from './SSButton'
import SSModal from './SSModal'
import SSText from './SSText'

type SSNip46ApprovalModalProps = {
  onApprove: (requestId: string, alwaysAllow: boolean) => void
  onReject: (requestId: string, alwaysReject: boolean) => void
  request: Nip46Request | null
  visible: boolean
}

function getMethodLabel(method: string): string {
  switch (method) {
    case 'sign_event':
      return t('nip46.approval.signEvent')
    case 'get_public_key':
      return t('nip46.approval.getPublicKey')
    case 'nip04_encrypt':
    case 'nip44_encrypt':
      return t('nip46.approval.encrypt')
    case 'nip04_decrypt':
    case 'nip44_decrypt':
      return t('nip46.approval.decrypt')
    default:
      return method
  }
}

function getEventPreview(params: string[]): {
  content: string
  kind: number
} | null {
  try {
    const parsed = JSON.parse(params[0]) as {
      content?: string
      kind?: number
    }
    return {
      content:
        typeof parsed.content === 'string' ? parsed.content.slice(0, 200) : '',
      kind: typeof parsed.kind === 'number' ? parsed.kind : 1
    }
  } catch {
    return null
  }
}

export default function SSNip46ApprovalModal({
  onApprove,
  onReject,
  request,
  visible
}: SSNip46ApprovalModalProps) {
  const [alwaysAllow, setAlwaysAllow] = useState(false)

  if (!request) {
    return null
  }

  const methodLabel = getMethodLabel(request.method)
  const eventPreview =
    request.method === 'sign_event' ? getEventPreview(request.params) : null

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
        <SSVStack gap="md" itemsCenter widthFull>
          <SSText size="lg" weight="bold" center>
            {t('nip46.approval.title')}
          </SSText>

          <SSVStack gap="sm" widthFull>
            <SSText size="sm" color="muted" uppercase>
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
                {eventPreview.content.length > 0 && (
                  <>
                    <SSText size="xs" color="muted">
                      {t('nip46.approval.eventContent')}:
                    </SSText>
                    <SSText size="xs" numberOfLines={4}>
                      {eventPreview.content}
                    </SSText>
                  </>
                )}
              </SSVStack>
            )}
          </SSVStack>

          <SSHStack gap="sm" style={styles.switchRow}>
            <Switch
              value={alwaysAllow}
              onValueChange={setAlwaysAllow}
              trackColor={{ false: Colors.gray[700], true: Colors.gray[500] }}
            />
            <SSText size="sm">{t('nip46.approval.alwaysAllow')}</SSText>
          </SSHStack>

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
  switchRow: {
    alignItems: 'center'
  }
})
