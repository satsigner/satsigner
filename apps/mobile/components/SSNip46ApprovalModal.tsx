import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import type { Nip46Request } from '@/types/models/Nip46'
import { getEventPreview, getMethodLabel } from '@/utils/nip46'

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
  const [alwaysAllow, setAlwaysAllow] = useState(true)

  if (!request) {
    return null
  }

  const methodLabel = getMethodLabel(request.method)
  const eventPreview =
    request.method === 'sign_event' ? getEventPreview(request.params) : null

  function handleApprove() {
    setAlwaysAllow(true)
    onApprove(request!.id, alwaysAllow)
  }

  function handleReject() {
    setAlwaysAllow(true)
    onReject(request!.id, false)
  }

  return (
    <SSModal visible={visible} fullOpacity onClose={handleReject}>
      <View style={styles.container}>
        <SSVStack gap="md" itemsCenter widthFull>
          <SSText size="lg" weight="bold" center>
            {t('nip46.approval.title')}
          </SSText>

          <SSCheckbox
            selected={alwaysAllow}
            label={t('nip46.approval.alwaysAllow')}
            labelProps={{ size: 'sm' }}
            onPress={() => setAlwaysAllow(!alwaysAllow)}
          />

          {!alwaysAllow && (
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
  }
})
