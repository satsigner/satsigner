import { StyleSheet } from 'react-native'

import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'
import { shareImage, shareText } from '@/utils/share'

import { SSIconShare } from './icons'
import SSButton, { type SSButtonProps } from './SSButton'
import SSText from './SSText'

export type SSShareButtonProps = {
  content: string
  type?: 'text' | 'image'
  dialogTitle?: string
} & Omit<SSButtonProps, 'label' | 'icon' | 'variant' | 'onPress'>

function SSShareButton({
  content,
  type = 'text',
  dialogTitle,
  ...props
}: SSShareButtonProps) {
  async function handleShare() {
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
