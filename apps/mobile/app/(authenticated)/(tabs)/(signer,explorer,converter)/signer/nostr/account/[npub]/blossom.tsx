import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { toast } from 'sonner-native'

import { fetchKind10063Servers } from '@/api/blossom'
import { NostrAPI } from '@/api/nostr'
import SSIconX from '@/components/icons/SSIconX'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import {
  BLOSSOM_DEFAULT_SERVER,
  BLOSSOM_POPULAR_SERVERS
} from '@/constants/nostr'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import { getPubKeyHexFromNpub } from '@/utils/nostr'

type BlossomParams = {
  npub: string
}

type ServerRowProps = {
  url: string
  isPrimary: boolean
  onRemove: () => void
}

function ServerRow({ url, isPrimary, onRemove }: ServerRowProps) {
  return (
    <SSHStack gap="sm" style={styles.serverRow}>
      <SSVStack gap="none" style={styles.serverRowText}>
        <SSHStack gap="xs" style={{ alignItems: 'center' }}>
          {isPrimary && (
            <View style={styles.primaryBadge}>
              <SSText size="xs" color="muted" uppercase>
                {t('nostrIdentity.blossom.primary')}
              </SSText>
            </View>
          )}
          <SSText size="sm" numberOfLines={1}>
            {url.replace(/^https?:\/\//, '')}
          </SSText>
        </SSHStack>
      </SSVStack>
      <TouchableOpacity
        onPress={onRemove}
        style={styles.removeButton}
        hitSlop={8}
      >
        <SSIconX width={10} height={10} />
      </TouchableOpacity>
    </SSHStack>
  )
}

export default function NostrBlossomServers() {
  const router = useRouter()
  const { npub } = useLocalSearchParams<BlossomParams>()

  const identity = useNostrIdentityStore((state) =>
    state.identities.find((i) => i.npub === npub)
  )
  const updateIdentity = useNostrIdentityStore((state) => state.updateIdentity)

  const [servers, setServers] = useState<string[]>(
    identity?.blossomServers?.length
      ? identity.blossomServers
      : [BLOSSOM_DEFAULT_SERVER]
  )
  const [customInput, setCustomInput] = useState('')
  const [isImporting, setIsImporting] = useState(false)

  function handleRemove(url: string) {
    setServers((prev) => prev.filter((s) => s !== url))
  }

  function handleAddCustom() {
    const normalized = customInput.trim().replace(/\/$/, '')
    if (!normalized) {
      return
    }
    const url = normalized.startsWith('http')
      ? normalized
      : `https://${normalized}`
    if (servers.includes(url)) {
      toast.error(t('nostrIdentity.blossom.alreadyAdded'))
      return
    }
    setServers((prev) => [...prev, url])
    setCustomInput('')
  }

  function handleAddPopular(url: string) {
    if (!servers.includes(url)) {
      setServers((prev) => [...prev, url])
    }
  }

  async function handleImportFromNostr() {
    const pubkeyHex = getPubKeyHexFromNpub(npub)
    if (!pubkeyHex) {
      return
    }
    const relays = identity?.relays?.length
      ? identity.relays
      : NostrAPI.INDEXING_RELAYS
    setIsImporting(true)
    try {
      const discovered = await fetchKind10063Servers(pubkeyHex, relays)
      if (discovered.length === 0) {
        toast.error(t('nostrIdentity.blossom.noServersFound'))
        return
      }
      setServers((prev) => {
        const merged = [...prev]
        for (const url of discovered) {
          if (!merged.includes(url)) {
            merged.push(url)
          }
        }
        return merged
      })
      toast.success(t('nostrIdentity.blossom.serversImported'))
    } catch {
      toast.error(t('nostrIdentity.blossom.importError'))
    } finally {
      setIsImporting(false)
    }
  }

  function handleSave() {
    updateIdentity(npub, {
      blossomServers: servers.length > 0 ? servers : undefined
    })
    toast.success(t('nostrIdentity.blossom.saved'))
    router.back()
  }

  const popularNotAdded = BLOSSOM_POPULAR_SERVERS.filter(
    (s) => !servers.includes(s.url)
  )

  if (!identity) {
    return (
      <SSMainLayout>
        <Stack.Screen
          options={{
            headerTitle: () => (
              <SSText uppercase>{t('nostrIdentity.blossom.title')}</SSText>
            )
          }}
        />
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
            <SSText uppercase>{t('nostrIdentity.blossom.title')}</SSText>
          )
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SSVStack gap="lg" style={styles.content}>
          <SSText size="xs" color="muted">
            {t('nostrIdentity.blossom.hint')}
          </SSText>

          {/* Configured servers */}
          {servers.length > 0 && (
            <SSVStack gap="xs">
              <SSHStack style={styles.sectionHeader}>
                <SSText size="sm" color="muted" uppercase>
                  {t('nostrIdentity.blossom.yourServers')}
                </SSText>
                <SSButton
                  label={
                    isImporting
                      ? t('nostrIdentity.blossom.importing')
                      : t('nostrIdentity.blossom.importFromNostr')
                  }
                  variant="ghost"
                  onPress={handleImportFromNostr}
                  disabled={isImporting}
                  style={styles.importButton}
                />
              </SSHStack>
              {servers.map((url, index) => (
                <ServerRow
                  key={url}
                  url={url}
                  isPrimary={index === 0}
                  onRemove={() => handleRemove(url)}
                />
              ))}
            </SSVStack>
          )}

          {/* Add custom server */}
          <SSVStack gap="sm">
            <SSText size="sm" color="muted" uppercase>
              {t('nostrIdentity.blossom.addCustom')}
            </SSText>
            <SSTextInput
              placeholder={t('nostrIdentity.blossom.inputPlaceholder')}
              value={customInput}
              onChangeText={setCustomInput}
              align="left"
              autoCapitalize="none"
              keyboardType="url"
            />
            <SSButton
              label={t('nostrIdentity.blossom.add')}
              variant="outline"
              onPress={handleAddCustom}
              disabled={!customInput.trim()}
            />
          </SSVStack>

          {/* Popular servers */}
          {popularNotAdded.length > 0 && (
            <SSVStack gap="sm">
              <SSText size="sm" color="muted" uppercase>
                {t('nostrIdentity.blossom.popular')}
              </SSText>
              {popularNotAdded.map((server) => (
                <SSHStack key={server.url} gap="sm" style={styles.popularRow}>
                  <SSVStack gap="none" style={styles.serverRowText}>
                    <SSText size="sm">{server.name}</SSText>
                    <SSText size="xs" color="muted">
                      {server.url.replace(/^https?:\/\//, '')}
                    </SSText>
                  </SSVStack>
                  <SSButton
                    label={t('nostrIdentity.blossom.add')}
                    variant="outline"
                    onPress={() => handleAddPopular(server.url)}
                    style={styles.addButton}
                  />
                </SSHStack>
              ))}
            </SSVStack>
          )}

          <SSButton
            label={t('nostrIdentity.settings.save')}
            variant="secondary"
            onPress={handleSave}
          />
        </SSVStack>
      </ScrollView>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  addButton: {
    paddingHorizontal: 16,
    width: 'auto'
  },
  content: {
    paddingBottom: 40
  },
  emptyContainer: {
    paddingVertical: 60
  },
  importButton: {
    height: 'auto',
    paddingVertical: 0,
    width: 'auto'
  },
  popularRow: {
    alignItems: 'center',
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    paddingBottom: 8
  },
  primaryBadge: {
    backgroundColor: Colors.gray[800],
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1
  },
  removeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4
  },
  sectionHeader: {
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  serverRow: {
    alignItems: 'center',
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    paddingBottom: 8
  },
  serverRowText: {
    flex: 1
  }
})
