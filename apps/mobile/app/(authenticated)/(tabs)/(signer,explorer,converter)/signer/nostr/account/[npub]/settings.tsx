import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router'
import { nip19 } from 'nostr-tools'
import { useState } from 'react'
import {
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import {
  type CacheCategory,
  clearAllCache,
  clearCacheCategory,
  getCacheCounts
} from '@/db/nostrCache'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import { nostrAccountHref } from '@/utils/nostrNavigation'

type SettingsParams = {
  npub: string
}

type CacheCounts = {
  feedNotes: number
  ownNotes: number
  ownZaps: number
  profiles: number
  zapReceipts: number
}

export default function NostrIdentitySettings() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<SettingsParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const updateIdentity = useNostrIdentityStore((state) => state.updateIdentity)
  const removeIdentity = useNostrIdentityStore((state) => state.removeIdentity)

  const [displayName, setDisplayName] = useState(identity?.displayName ?? '')
  const [pictureUrl, setPictureUrl] = useState(identity?.picture ?? '')
  const [nip05, setNip05] = useState(identity?.nip05 ?? '')
  const [lud16, setLud16] = useState(identity?.lud16 ?? '')
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [clearAllModalVisible, setClearAllModalVisible] = useState(false)
  const [cacheCounts, setCacheCounts] = useState<CacheCounts>(() => {
    if (!npub) {
      return {
        feedNotes: 0,
        ownNotes: 0,
        ownZaps: 0,
        profiles: 0,
        zapReceipts: 0
      }
    }
    try {
      const hex = nip19.decode(npub).data as string
      return getCacheCounts(hex)
    } catch {
      return {
        feedNotes: 0,
        ownNotes: 0,
        ownZaps: 0,
        profiles: 0,
        zapReceipts: 0
      }
    }
  })

  function getHexPubkey(): string {
    if (!npub) {
      return ''
    }
    try {
      return nip19.decode(npub).data as string
    } catch {
      return ''
    }
  }

  function refreshCacheCounts() {
    const hex = getHexPubkey()
    if (!hex) {
      return
    }
    setCacheCounts(getCacheCounts(hex))
  }

  function handleClearCategory(category: CacheCategory) {
    clearCacheCategory(category, getHexPubkey())
    refreshCacheCounts()
    toast.success(t('nostrIdentity.settings.cache.cleared'))
  }

  function handleClearAll() {
    setClearAllModalVisible(false)
    clearAllCache()
    refreshCacheCounts()
    toast.success(t('nostrIdentity.settings.cache.cleared'))
  }

  function handleSave() {
    if (!npub) {
      return
    }

    updateIdentity(npub, {
      displayName: displayName || undefined,
      lud16: lud16 || undefined,
      nip05: nip05 || undefined,
      picture: pictureUrl || undefined
    })

    toast.success(t('nostrIdentity.settings.saved'))
    router.back()
  }

  function handleDeletePress() {
    setDeleteModalVisible(true)
  }

  function handleConfirmDelete() {
    setDeleteModalVisible(false)
    removeIdentity(npub)
    router.navigate('/signer/nostr' as Href)
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
            <SSText uppercase>{t('nostrIdentity.settings.title')}</SSText>
          )
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SSVStack gap="lg" style={styles.content}>
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
            label={t('nostrIdentity.settings.manageKeys')}
            variant="outline"
            onPress={() => router.navigate(nostrAccountHref(npub, 'keys'))}
          />

          <SSButton
            label={t('nostrIdentity.settings.identityRelays')}
            variant="outline"
            onPress={() => router.navigate(nostrAccountHref(npub, 'relays'))}
          />

          <SSButton
            label={t('nostrIdentity.settings.zapSettings')}
            variant="outline"
            onPress={() =>
              router.navigate(nostrAccountHref(npub, 'zapSettings'))
            }
          />

          <SSVStack gap="sm" style={styles.cacheSection}>
            <SSText size="sm" color="muted" uppercase>
              {t('nostrIdentity.settings.cache.title')}
            </SSText>

            <CacheRow
              label={t('nostrIdentity.settings.cache.ownNotes')}
              count={cacheCounts.ownNotes}
              onClear={() => handleClearCategory('ownNotes')}
            />
            <CacheRow
              label={t('nostrIdentity.settings.cache.ownZaps')}
              count={cacheCounts.ownZaps}
              onClear={() => handleClearCategory('ownZaps')}
            />
            <CacheRow
              label={t('nostrIdentity.settings.cache.feedNotes')}
              count={cacheCounts.feedNotes}
              onClear={() => handleClearCategory('feedNotes')}
            />
            <CacheRow
              label={t('nostrIdentity.settings.cache.zapReceipts')}
              count={cacheCounts.zapReceipts}
              onClear={() => handleClearCategory('zapReceipts')}
            />
            <CacheRow
              label={t('nostrIdentity.settings.cache.profiles')}
              count={cacheCounts.profiles}
              onClear={() => handleClearCategory('profiles')}
            />

            <SSButton
              label={t('nostrIdentity.settings.cache.clearAll')}
              variant="ghost"
              onPress={() => setClearAllModalVisible(true)}
            />
          </SSVStack>

          <SSButton
            label={t('nostrIdentity.settings.save')}
            variant="secondary"
            onPress={handleSave}
          />

          <SSButton
            label={t('nostrIdentity.settings.deleteIdentity')}
            variant="danger"
            onPress={handleDeletePress}
          />
        </SSVStack>
      </ScrollView>

      <SSModal
        visible={deleteModalVisible}
        fullOpacity
        label={t('common.cancel')}
        onClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.deleteSheet}>
          <SSVStack gap="md" itemsCenter widthFull>
            <SSVStack gap="sm" itemsCenter widthFull>
              <SSText center size="sm" color="muted" uppercase>
                {t('nostrIdentity.settings.deleteModalTitle')}
              </SSText>
              <SSText center color="muted" size="sm">
                {t('nostrIdentity.settings.deleteConfirm')}
              </SSText>
            </SSVStack>
            <SSButton
              label={t('common.delete')}
              variant="danger"
              onPress={handleConfirmDelete}
            />
          </SSVStack>
        </View>
      </SSModal>

      <SSModal
        visible={clearAllModalVisible}
        fullOpacity
        label={t('common.cancel')}
        onClose={() => setClearAllModalVisible(false)}
      >
        <View style={styles.deleteSheet}>
          <SSVStack gap="md" itemsCenter widthFull>
            <SSVStack gap="sm" itemsCenter widthFull>
              <SSText center size="sm" color="muted" uppercase>
                {t('nostrIdentity.settings.cache.clearAllTitle')}
              </SSText>
              <SSText center color="muted" size="sm">
                {t('nostrIdentity.settings.cache.clearAllConfirm')}
              </SSText>
            </SSVStack>
            <SSButton
              label={t('nostrIdentity.settings.cache.clearAll')}
              variant="danger"
              onPress={handleClearAll}
            />
          </SSVStack>
        </View>
      </SSModal>
    </SSMainLayout>
  )
}

type CacheRowProps = {
  label: string
  count: number
  onClear: () => void
}

function CacheRow({ label, count, onClear }: CacheRowProps) {
  return (
    <SSHStack gap="sm" style={cacheRowStyles.row}>
      <SSText size="sm" style={cacheRowStyles.label}>
        {label}
      </SSText>
      <SSText size="sm" color="muted" style={cacheRowStyles.count}>
        {count}
      </SSText>
      <TouchableOpacity
        onPress={onClear}
        disabled={count === 0}
        style={cacheRowStyles.clearButton}
        activeOpacity={0.6}
      >
        <SSText size="xs" color={count === 0 ? 'muted' : 'white'} uppercase>
          {t('common.clear')}
        </SSText>
      </TouchableOpacity>
    </SSHStack>
  )
}

const cacheRowStyles = StyleSheet.create({
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  count: {
    minWidth: 32,
    textAlign: 'right'
  },
  label: {
    flex: 1
  },
  row: {
    alignItems: 'center',
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    paddingVertical: 8
  }
})

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
  cacheSection: {
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    padding: 12
  },
  content: {
    paddingBottom: 40
  },
  deleteSheet: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
    width: '100%'
  },
  emptyContainer: {
    paddingVertical: 60
  }
})
