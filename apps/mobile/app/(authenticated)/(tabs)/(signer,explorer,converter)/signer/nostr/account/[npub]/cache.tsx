import { Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { toast } from 'sonner-native'

import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
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
import { Colors } from '@/styles'
import { getPubKeyHexFromNpub } from '@/utils/nostr'

type CacheParams = {
  npub: string
}

type CacheCounts = {
  feedNotes: number
  ownNotes: number
  ownZaps: number
  profiles: number
  zapReceipts: number
}

function getInitialCounts(npub: string | undefined): CacheCounts {
  const empty = {
    feedNotes: 0,
    ownNotes: 0,
    ownZaps: 0,
    profiles: 0,
    zapReceipts: 0
  }
  if (!npub) {
    return empty
  }
  try {
    const hex = getPubKeyHexFromNpub(npub)
    return hex ? getCacheCounts(hex) : empty
  } catch {
    return empty
  }
}

export default function NostrIdentityCache() {
  const { npub } = useLocalSearchParams<CacheParams>()
  const [cacheCounts, setCacheCounts] = useState<CacheCounts>(() =>
    getInitialCounts(npub)
  )
  const [clearAllModalVisible, setClearAllModalVisible] = useState(false)

  function getHexPubkey(): string {
    return getPubKeyHexFromNpub(npub ?? '') ?? ''
  }

  function refreshCounts() {
    const hex = getHexPubkey()
    if (!hex) {
      return
    }
    setCacheCounts(getCacheCounts(hex))
  }

  function handleClearCategory(category: CacheCategory) {
    clearCacheCategory(category, getHexPubkey())
    refreshCounts()
    toast.success(t('nostrIdentity.settings.cache.cleared'))
  }

  function handleClearAll() {
    setClearAllModalVisible(false)
    clearAllCache()
    refreshCounts()
    toast.success(t('nostrIdentity.settings.cache.cleared'))
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>
              {t('nostrIdentity.settings.cache.nostrCache')}
            </SSText>
          )
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SSVStack gap="lg" style={styles.content}>
          <SSVStack gap="sm" style={styles.section}>
            <SSText size="sm" color="muted" uppercase>
              {t('nostrIdentity.settings.cache.thisIdentity')}
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
          </SSVStack>

          <SSVStack gap="sm" style={styles.section}>
            <SSText size="sm" color="muted" uppercase>
              {t('nostrIdentity.settings.cache.allNostr')}
            </SSText>
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
          </SSVStack>

          <SSButton
            label={t('nostrIdentity.settings.cache.clearAll')}
            variant="danger"
            onPress={() => setClearAllModalVisible(true)}
          />
        </SSVStack>
      </ScrollView>

      <SSModal
        visible={clearAllModalVisible}
        fullOpacity
        label={t('common.cancel')}
        onClose={() => setClearAllModalVisible(false)}
      >
        <View style={styles.modalSheet}>
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
    <SSHStack gap="sm" style={rowStyles.row}>
      <SSText size="sm" style={rowStyles.label}>
        {label}
      </SSText>
      <SSText size="sm" color="muted" style={rowStyles.count}>
        {count}
      </SSText>
      <TouchableOpacity
        onPress={onClear}
        disabled={count === 0}
        style={rowStyles.clearButton}
        activeOpacity={0.6}
      >
        <SSText size="xs" color={count === 0 ? 'muted' : 'white'} uppercase>
          {t('common.clear')}
        </SSText>
      </TouchableOpacity>
    </SSHStack>
  )
}

const rowStyles = StyleSheet.create({
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
  content: {
    paddingBottom: 40
  },
  modalSheet: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
    width: '100%'
  },
  section: {
    borderColor: Colors.gray[800],
    borderRadius: 3,
    borderWidth: 1,
    padding: 12
  }
})
