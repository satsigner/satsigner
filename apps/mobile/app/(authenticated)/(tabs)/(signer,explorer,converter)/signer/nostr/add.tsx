import { Stack, useRouter } from 'expo-router'
import { StyleSheet } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

export default function NostrAddIdentity() {
  const router = useRouter()

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.addIdentity')}</SSText>
          )
        }}
      />
      <SSVStack gap="lg" style={styles.body}>
        <SSVStack gap="sm">
          <SSText size="lg" weight="medium">
            {t('nostrIdentity.add.title')}
          </SSText>
          <SSText color="muted" size="sm">
            {t('nostrIdentity.add.description')}
          </SSText>
        </SSVStack>
        <SSVStack gap="sm">
          <SSButton
            label={t('nostrIdentity.createNew')}
            onPress={() => router.navigate('/signer/nostr/create')}
            variant="gradient"
            gradientType="special"
          />
          <SSButton
            label={t('nostrIdentity.importExisting')}
            onPress={() => router.navigate('/signer/nostr/import')}
            variant="secondary"
          />
        </SSVStack>
      </SSVStack>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  body: {
    paddingTop: 8
  }
})
