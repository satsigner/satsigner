import { Redirect, Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSNostrKind0FetchWarningModal from '@/components/SSNostrKind0FetchWarningModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { NOSTR_BLOSSOM_DEFAULT_SERVER } from '@/constants/nostr'
import useBlossomImageUpload from '@/hooks/useBlossomImageUpload'
import { useNostrIdentityAdd } from '@/hooks/useNostrIdentityAdd'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityDraftStore } from '@/store/nostrIdentityDraft'
import { Colors } from '@/styles'
import { deriveNostrKeysFromMnemonic } from '@/utils/nostrIdentity'
import { nostrIndexHref } from '@/utils/nostrNavigation'

export default function ProfileSetup() {
  const router = useRouter()
  const mnemonic = useNostrIdentityDraftStore((state) => state.mnemonic)
  const keys = mnemonic ? deriveNostrKeysFromMnemonic(mnemonic) : null
  const {
    fetchProfile,
    fetchProfileAlways,
    requestAdd,
    saveWithoutFetching,
    warningVisible
  } = useNostrIdentityAdd(handleIdentityAdded)

  const [displayName, setDisplayName] = useState('')
  const [pictureUrl, setPictureUrl] = useState('')
  const [nip05, setNip05] = useState('')
  const [lud16, setLud16] = useState('')
  const { isUploading: isPictureUploading, upload: uploadPicture } =
    useBlossomImageUpload(keys?.nsec ?? '')

  async function handleUploadPicture() {
    const url = await uploadPicture(NOSTR_BLOSSOM_DEFAULT_SERVER)
    if (url) {
      setPictureUrl(url)
    }
  }

  function handleIdentityAdded() {
    useNostrIdentityDraftStore.getState().clearDraft()
    toast.success(t('nostrIdentity.create.success'))
    router.dismissTo(nostrIndexHref())
  }

  function handleSave() {
    if (!mnemonic || !keys) {
      toast.error(t('nostrIdentity.error.missingKeys'))
      return
    }

    requestAdd({
      createdAt: Date.now(),
      displayName: displayName || undefined,
      isWatchOnly: false,
      lud16: lud16 || undefined,
      mnemonic,
      nip05: nip05 || undefined,
      npub: keys.npub,
      nsec: keys.nsec,
      picture: pictureUrl || undefined
    })
  }

  if (!keys) {
    return <Redirect href="/signer/nostr/create" />
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
      <SSScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SSVStack gap="lg" style={styles.content}>
          {/* Avatar Preview */}
          <SSVStack itemsCenter gap="sm">
            <View style={styles.avatarContainer}>
              {pictureUrl ? (
                <Image source={{ uri: pictureUrl }} style={styles.avatar} />
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
            <SSButton
              label={
                isPictureUploading
                  ? t('nostrIdentity.profile.uploading')
                  : t('nostrIdentity.profile.uploadImage')
              }
              variant="outline"
              disabled={isPictureUploading}
              onPress={handleUploadPicture}
            />
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
      </SSScrollView>
      <SSNostrKind0FetchWarningModal
        visible={warningVisible}
        onFetch={fetchProfile}
        onFetchAlways={fetchProfileAlways}
        onSaveWithoutFetching={saveWithoutFetching}
      />
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
