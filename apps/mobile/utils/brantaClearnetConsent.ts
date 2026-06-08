import { Alert } from 'react-native'

import { t } from '@/locales'

function askBrantaClearnetConsent(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      t('branta.clearnet.title'),
      t('branta.clearnet.message'),
      [
        {
          onPress: () => resolve(false),
          style: 'cancel',
          text: t('common.cancel')
        },
        {
          onPress: () => resolve(true),
          text: t('branta.clearnet.continue')
        }
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    )
  })
}

function askBrantaImageLoadConsent(imageUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      t('branta.clearnet.imageTitle'),
      t('branta.clearnet.imageMessage', { url: imageUrl }),
      [
        {
          onPress: () => resolve(false),
          style: 'cancel',
          text: t('common.cancel')
        },
        {
          onPress: () => resolve(true),
          text: t('branta.clearnet.imageContinue')
        }
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    )
  })
}

export { askBrantaClearnetConsent, askBrantaImageLoadConsent }
