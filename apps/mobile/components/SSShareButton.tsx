import { type RefObject } from 'react'
import { StyleSheet, type View } from 'react-native'
import { toast } from 'sonner-native'

import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { shareImage, shareText, shareViewAsImage } from '@/utils/share'

import { SSIconShare } from './icons'
import SSButton, { type SSButtonProps } from './SSButton'
import SSText from './SSText'

type SSShareButtonBaseProps = {
  dialogTitle?: string
} & Omit<SSButtonProps, 'label' | 'icon' | 'variant' | 'onPress'>

export type SSShareButtonProps = SSShareButtonBaseProps &
  (
    | { content: string; type?: 'text' | 'image'; qrRef?: undefined }
    | { qrRef: RefObject<View | null>; content?: undefined; type?: undefined }
  )

function SSShareButton({
  content,
  type = 'text',
  qrRef,
  dialogTitle,
  ...props
}: SSShareButtonProps) {
  async function handleShare() {
    if (qrRef) {
      try {
        await shareViewAsImage({
          dialogTitle: dialogTitle ?? t('common.share'),
          viewRef: qrRef
        })
      } catch {
        toast.error(t('common.shareError'))
      }
      return
    }
    if (type === 'image') {
      await shareImage({
        dialogTitle: dialogTitle ?? t('common.share'),
        uri: content
      })
      return
    }
    await shareText({ content, dialogTitle })
  }

  return (
    <SSButton
      variant="outline"
      onPress={handleShare}
      icon={
        <SSHStack gap="xs">
          <SSText uppercase color="white" style={styles.label}>
            {t('common.share')}
          </SSText>
          <SSIconShare height={16} width={16} stroke="#FFFFFF" />
        </SSHStack>
      }
      {...props}
    />
  )
}

const styles = StyleSheet.create({
  label: {
    letterSpacing: 1
  }
})

export default SSShareButton
