import { useRouter } from 'expo-router'
import { Image, ScrollView } from 'react-native'

import SSIconWarningSharp from '@/components/icons/SSIconWarningSharp'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useSettingsStore } from '@/store/settings'
import { Layout } from '@/styles'

export default function Warning() {
  const router = useRouter()
  const setShowWarning = useSettingsStore((state) => state.setShowWarning)

  function handleConfirm() {
    setShowWarning(false)
    router.replace('/')
  }

  return (
    <SSMainLayout
      black
      style={{
        paddingBottom: Layout.mainContainer.paddingBottom,
        paddingTop: '20%'
      }}
    >
      <SSVStack gap="md" justifyBetween>
        <ScrollView
          style={{ marginBottom: 24 }}
          showsVerticalScrollIndicator={false}
        >
          <SSVStack itemsCenter>
            <Image
              source={require('@/assets/icon.png')}
              style={{ width: 64, height: 64 }}
            />

            <SSVStack gap="xs" itemsCenter>
              <SSText
                size="xs"
                color="white"
                uppercase
                style={{ fontWeight: '500', letterSpacing: 1 }}
              >
                {t('warning.subtitle')}
              </SSText>
              <SSText
                size="5xl"
                color="white"
                uppercase
                style={{ lineHeight: 35, fontWeight: '300', letterSpacing: 2 }}
              >
                {t('common.warning')}
              </SSText>
            </SSVStack>
            <SSIconWarningSharp
              width={120}
              height={120}
              fill="black"
              stroke="white"
            />
            <SSText
              size="3xl"
              color="white"
              style={{
                fontWeight: '500',
                letterSpacing: 1,
                textAlign: 'center'
              }}
            >
              {t('warning.title')}
            </SSText>
            <SSText
              size="sm"
              color="muted"
              style={{ fontWeight: '400', letterSpacing: 0.5 }}
            >
              {t('warning.content')}
            </SSText>
          </SSVStack>
        </ScrollView>
        <SSVStack>
          <SSButton
            variant="secondary"
            label={t('common.acknowledge')}
            onPress={() => handleConfirm()}
          />
          <SSButton
            variant="ghost"
            label={t('common.dismiss')}
            onPress={() => router.push('/')}
          />
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}
