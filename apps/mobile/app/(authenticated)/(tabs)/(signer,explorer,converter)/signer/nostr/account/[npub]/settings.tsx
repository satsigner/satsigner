import { LinearGradient } from 'expo-linear-gradient'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'

import {
  SSIconCalendar,
  SSIconChatBubble,
  SSIconContacts,
  SSIconFiles
} from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import { nostrAccountHref, nostrIndexHref } from '@/utils/nostrNavigation'

type SettingsParams = {
  npub: string
}

// Gradient start x shifts left→right across chiclets to simulate a single
// overhead light source landing at a slightly different angle on each tile.
const CHICLET_GRADIENT_STARTS: { x: number; y: number }[] = [
  { x: 0.15, y: 0 },
  { x: 0.38, y: 0 },
  { x: 0.62, y: 0 },
  { x: 0.85, y: 0 }
]

export default function NostrIdentitySettings() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<SettingsParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const removeIdentity = useNostrIdentityStore((state) => state.removeIdentity)

  const [deleteModalVisible, setDeleteModalVisible] = useState(false)

  function handleConfirmDelete() {
    setDeleteModalVisible(false)
    removeIdentity(npub)
    router.navigate(nostrIndexHref())
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
          <SSHStack gap="sm">
            <Chiclet
              gradientStart={CHICLET_GRADIENT_STARTS[0]}
              label={t('nostrIdentity.chat.title')}
              onPress={() => router.navigate(nostrAccountHref(npub, 'chat'))}
            >
              <SSIconChatBubble color={Colors.white} height={24} width={24} />
            </Chiclet>
            <Chiclet
              gradientStart={CHICLET_GRADIENT_STARTS[1]}
              label={t('nostrIdentity.contacts.title')}
              onPress={() =>
                router.navigate(nostrAccountHref(npub, 'contacts'))
              }
            >
              <SSIconContacts color={Colors.white} height={24} width={24} />
            </Chiclet>
            <Chiclet
              gradientStart={CHICLET_GRADIENT_STARTS[2]}
              label={t('nostrIdentity.calendar.title')}
              onPress={() =>
                router.navigate(nostrAccountHref(npub, 'calendar'))
              }
            >
              <SSIconCalendar color={Colors.white} height={24} width={24} />
            </Chiclet>
            <Chiclet
              gradientStart={CHICLET_GRADIENT_STARTS[3]}
              label={t('nostrIdentity.files.title')}
              onPress={() => router.navigate(nostrAccountHref(npub, 'files'))}
            >
              <SSIconFiles color={Colors.white} height={24} width={24} />
            </Chiclet>
          </SSHStack>

          <SSVStack gap="xs" widthFull>
            <SSButton
              label={t('nostrIdentity.settings.profile')}
              variant="outline"
              onPress={() => router.navigate(nostrAccountHref(npub, 'profile'))}
            />

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

            {!identity.isWatchOnly && (
              <SSButton
                label={t('nip46.title')}
                variant="outline"
                onPress={() =>
                  router.navigate(nostrAccountHref(npub, 'bunker'))
                }
              />
            )}

            <SSButton
              label={t('nostrIdentity.settings.cache.title')}
              variant="outline"
              onPress={() => router.navigate(nostrAccountHref(npub, 'cache'))}
            />

            <SSButton
              label={t('nostrIdentity.settings.deleteIdentity')}
              variant="danger"
              onPress={() => setDeleteModalVisible(true)}
            />
          </SSVStack>
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
    </SSMainLayout>
  )
}

type ChicletProps = {
  children: React.ReactNode
  gradientStart: { x: number; y: number }
  label: string
  onPress: () => void
}

function Chiclet({ children, gradientStart, label, onPress }: ChicletProps) {
  return (
    <TouchableOpacity
      style={styles.chiclet}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.chicletTile}>
        <LinearGradient
          colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0)']}
          start={gradientStart}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          style={[styles.glassBorder, styles.glassBorderTop]}
          colors={[
            'rgba(255,255,255,0.16)',
            'rgba(255,255,255,0.30)',
            'rgba(255,255,255,0.18)'
          ]}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        <LinearGradient
          style={[styles.glassBorder, styles.glassBorderBottom]}
          colors={[
            'rgba(255,255,255,0.06)',
            'rgba(255,255,255,0.20)',
            'rgba(255,255,255,0.06)'
          ]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        <LinearGradient
          style={[styles.glassBorder, styles.glassBorderLeft]}
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.14)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <LinearGradient
          style={[styles.glassBorder, styles.glassBorderRight]}
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.13)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        />
        <View style={styles.chicletContent}>{children}</View>
      </View>
      <SSText size="xs" color="muted" uppercase center style={styles.chicletLabel}>
        {label}
      </SSText>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  chiclet: {
    alignItems: 'center',
    flex: 1,
    gap: 6
  },
  chicletTile: {
    aspectRatio: 1,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%'
  },
  chicletContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center'
  },
  chicletLabel: {
    paddingHorizontal: 2
  },
  glassBorder: {
    position: 'absolute'
  },
  glassBorderBottom: {
    bottom: 0,
    height: 1,
    left: 0,
    right: 0
  },
  glassBorderLeft: {
    bottom: 0,
    left: 0,
    top: 0,
    width: 1
  },
  glassBorderRight: {
    bottom: 0,
    right: 0,
    top: 0,
    width: 1
  },
  glassBorderTop: {
    height: 1,
    left: 0,
    right: 0,
    top: 0
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
