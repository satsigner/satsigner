import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

type SSMessageActionsModalProps = {
  visible: boolean
  preview: string
  canReply: boolean
  onReply: () => void
  onCopy: () => void
  onDetails: () => void
  onClose: () => void
}

/** Long-press menu of a chat message; deletion lives on the details page. */
function SSMessageActionsModal({
  visible,
  preview,
  canReply,
  onReply,
  onCopy,
  onDetails,
  onClose
}: SSMessageActionsModalProps) {
  return (
    <SSModal visible={visible} onClose={onClose}>
      <SSVStack gap="sm">
        <SSText color="muted" numberOfLines={3} center>
          {preview}
        </SSText>
        {canReply ? (
          <SSButton
            label={t('nostrIdentity.chat.message.reply')}
            onPress={onReply}
          />
        ) : null}
        <SSButton
          label={t('nostrIdentity.chat.message.copyText')}
          onPress={onCopy}
          variant="outline"
        />
        <SSButton
          label={t('nostrIdentity.chat.actions.details')}
          onPress={onDetails}
          variant="outline"
        />
      </SSVStack>
    </SSModal>
  )
}

export default SSMessageActionsModal
