import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Image, ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'

type ProfileParams = {
  mnemonic: string
  nsec: string
  npub: string
}

export default function ProfileSetup() {
  const router = useRouter()
  const params = useLocalSearchParams<ProfileParams>()
  const addIdentity = useNostrIdentityStore((state) => state.addIdentity)

  const [displayName, setDisplayName] = useState('')
  const [pictureUrl, setPictureUrl] = useState('')
  const [nip05, setNip05] = useState('')
  const [lud16, setLud16] = useState('')

  function handleSave() {
    if (!params.npub || !params.nsec) {
      toast.error(t('nostrIdentity.error.missingKeys'))
      return
    }

    addIdentity({
      npub: params.npub,
      nsec: params.nsec,
      mnemonic: params.mnemonic,
      displayName: displayName || undefined,
      picture: pictureUrl || undefined,
      nip05: nip05 || undefined,
      lud16: lud16 || undefined,
      createdAt: Date.now(),
      isWatchOnly: false
    })

    toast.success(t('nostrIdentity.create.success'))
    router.navigate('/signer/nostr')
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.profile.title')}</SSText>
          )
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SSVStack gap="lg" style={styles.content}>
          {/* Avatar Preview */}
          <SSVStack itemsCenter gap="sm">
            <View style={styles.avatarContainer}>
              {pictureUrl ? (
                <Image
                  source={{ uri: pictureUrl }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <SSText size="3xl" weight="bold">
                    {displayName?.[0]?.toUpperCase() || 'N'}
                  </SSText>
                </View>
              )}
            </View>
          </SSVStack>

          {/* Display Name */}
          <SSVStack gap="xs">
            <SSText size="sm" color="muted" uppercase>
              {t('nostrIdentity.profile.displayName')}
            </SSText>
            <SSTextInput
              placeholder={t('nostrIdentity.profile.displayNamePlaceholder')}
              value={displayName}
              onChangeText={setDisplayName}
              align="left"
            />
          </SSVStack>

          {/* Profile Image URL (Blossom) */}
          <SSVStack gap="xs">
            <SSText size="sm" color="muted" uppercase>
              {t('nostrIdentity.profile.picture')}
            </SSText>
            <SSTextInput
              placeholder={t('nostrIdentity.profile.picturePlaceholder')}
              value={pictureUrl}
              onChangeText={setPictureUrl}
              align="left"
              autoCapitalize="none"
              keyboardType="url"
            />
            <SSText size="xs" color="muted">
              {t('nostrIdentity.profile.pictureHint')}
            </SSText>
          </SSVStack>

          {/* NIP-05 */}
          <SSVStack gap="xs">
            <SSText size="sm" color="muted" uppercase>
              {t('nostrIdentity.profile.nip05')}
            </SSText>
            <SSTextInput
              placeholder={t('nostrIdentity.profile.nip05Placeholder')}
              value={nip05}
              onChangeText={setNip05}
              align="left"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </SSVStack>

          {/* LUD-16 Lightning Address */}
          <SSVStack gap="xs">
            <SSText size="sm" color="muted" uppercase>
              {t('nostrIdentity.profile.lud16')}
            </SSText>
            <SSTextInput
              placeholder={t('nostrIdentity.profile.lud16Placeholder')}
              value={lud16}
              onChangeText={setLud16}
              align="left"
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </SSVStack>

          <SSButton
            label={t('nostrIdentity.profile.save')}
            variant="secondary"
            onPress={handleSave}
          />
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 40,
    height: 80,
    width: 80
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    justifyContent: 'center'
  },
  content: {
    paddingBottom: 40
  }
})
