import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { NOSTR_BLOSSOM_DEFAULT_SERVER } from '@/constants/nostr'
import useBlossomImageUpload from '@/hooks/useBlossomImageUpload'
import { useNostrProfileSave } from '@/hooks/useNostrProfileSave'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSScrollView from '@/layouts/SSScrollView'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import { getNostrErrorMessage } from '@/utils/nostrErrorMessage'

type ProfileParams = {
  npub: string
}

export default function NostrIdentityProfile() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<ProfileParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const {
    isPending: isSaving,
    mutate: saveProfile,
    publishes
  } = useNostrProfileSave(identity)

  const [displayName, setDisplayName] = useState(identity?.displayName ?? '')
  const [pictureUrl, setPictureUrl] = useState(identity?.picture ?? '')
  const [bannerUrl, setBannerUrl] = useState(identity?.banner ?? '')
  const [nip05, setNip05] = useState(identity?.nip05 ?? '')
  const [lud16, setLud16] = useState(identity?.lud16 ?? '')
  const primaryBlossomServer =
    identity?.blossomServers?.[0] ?? NOSTR_BLOSSOM_DEFAULT_SERVER

  const { isUploading: isPictureUploading, upload: uploadPicture } =
    useBlossomImageUpload(identity?.nsec ?? '')
  const { isUploading: isBannerUploading, upload: uploadBanner } =
    useBlossomImageUpload(identity?.nsec ?? '')

  async function handleUploadPicture() {
    const url = await uploadPicture(primaryBlossomServer)
    if (url) {
      setPictureUrl(url)
    }
  }

  async function handleUploadBanner() {
    const url = await uploadBanner(primaryBlossomServer)
    if (url) {
      setBannerUrl(url)
    }
  }

  function handleSaveSuccess() {
    toast.success(t('nostrIdentity.settings.saved'))
    router.back()
  }

  function handleSaveError(error: Error) {
    toast.error(
      `${t('nostrIdentity.profile.publishFailed')}: ${getNostrErrorMessage(error)}`
    )
  }

  function handleSave() {
    saveProfile(
      {
        banner: bannerUrl || undefined,
        displayName: displayName || undefined,
        lud16: lud16 || undefined,
        nip05: nip05 || undefined,
        picture: pictureUrl || undefined
      },
      { onError: handleSaveError, onSuccess: handleSaveSuccess }
    )
  }

  if (!identity) {
    return (
      <SSMainLayout>
        <SSVStack itemsCenter gap="lg" style={styles.emptyContainer}>
          <SSText color="muted">{t('nostrIdentity.account.notFound')}</SSText>
        </SSVStack>
      </SSMainLayout>
    )
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
          {/* Banner + Avatar preview */}
          <View style={styles.headerContainer}>
            <View style={styles.bannerContainer}>
              {bannerUrl ? (
                <Image
                  source={{ uri: bannerUrl }}
                  style={styles.bannerImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.bannerPlaceholder} />
              )}
            </View>
            <View style={styles.avatarWrapper}>
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
          </View>

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

          {/* Profile Picture */}
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
            {!identity.isWatchOnly && (
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
            )}
          </SSVStack>

          {/* Banner Image */}
          <SSVStack gap="xs">
            <SSText size="sm" color="muted" uppercase>
              {t('nostrIdentity.profile.banner')}
            </SSText>
            <SSTextInput
              placeholder={t('nostrIdentity.profile.bannerPlaceholder')}
              value={bannerUrl}
              onChangeText={setBannerUrl}
              align="left"
              autoCapitalize="none"
              keyboardType="url"
            />
            <SSText size="xs" color="muted">
              {t('nostrIdentity.profile.bannerHint')}
            </SSText>
            {!identity.isWatchOnly && (
              <SSButton
                label={
                  isBannerUploading
                    ? t('nostrIdentity.profile.uploading')
                    : t('nostrIdentity.profile.uploadBanner')
                }
                variant="outline"
                disabled={isBannerUploading}
                onPress={handleUploadBanner}
              />
            )}
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

          {/* LUD-16 */}
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
            label={
              publishes
                ? t('nostrIdentity.profile.saveAndPublish')
                : t('nostrIdentity.settings.save')
            }
            variant="secondary"
            loading={isSaving}
            // Saving mid-upload would publish without the new image.
            disabled={isPictureUploading || isBannerUploading}
            onPress={handleSave}
          />
        </SSVStack>
      </SSScrollView>
    </SSMainLayout>
  )
}

const BANNER_HEIGHT = 160
const AVATAR_SIZE = 80
const AVATAR_OVERLAP = AVATAR_SIZE / 2

const styles = StyleSheet.create({
  avatar: {
    borderColor: Colors.gray[950],
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3,
    height: AVATAR_SIZE,
    width: AVATAR_SIZE
  },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: Colors.gray[800],
    justifyContent: 'center'
  },
  avatarWrapper: {
    alignSelf: 'center',
    marginTop: -AVATAR_OVERLAP
  },
  bannerContainer: {
    height: BANNER_HEIGHT,
    width: '100%'
  },
  bannerImage: {
    height: '100%',
    width: '100%'
  },
  bannerPlaceholder: {
    backgroundColor: Colors.gray[800],
    height: '100%',
    width: '100%'
  },
  content: {
    paddingBottom: 40
  },
  emptyContainer: {
    paddingVertical: 60
  },
  headerContainer: {
    marginHorizontal: -16
  }
})
