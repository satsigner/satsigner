import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { Dimensions, ScrollView, StyleSheet, View } from 'react-native'
import { type Network } from 'react-native-bdk-sdk'
import { type SceneRendererProps, TabView } from 'react-native-tab-view'
import { toast } from 'sonner-native'

import SSActionButton from '@/components/SSActionButton'
import SSButton from '@/components/SSButton'
import SSCameraModal from '@/components/SSCameraModal'
import SSSeedWordsInput from '@/components/SSSeedWordsInput'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useNostrIdentityStore } from '@/store/nostrIdentity'
import { Colors } from '@/styles'
import { type DetectedContent } from '@/utils/contentDetector'
import {
  deriveNostrKeysFromMnemonic,
  npubFromNsec
} from '@/utils/nostrIdentity'

const ROUTES = [
  { key: 'nsec', title: 'nsec' },
  { key: 'seedWords', title: 'Seed Words' },
  { key: 'npub', title: 'npub' }
]

export default function ImportNostrIdentity() {
  const router = useRouter()
  const addIdentity = useNostrIdentityStore((state) => state.addIdentity)
  const layout = Dimensions.get('window')
  const [tabIndex, setTabIndex] = useState(0)

  const [nsec, setNsec] = useState('')
  const [validMnemonic, setValidMnemonic] = useState<string | null>(null)
  const [npub, setNpub] = useState('')
  const [cameraVisible, setCameraVisible] = useState(false)
  const [scanTarget, setScanTarget] = useState<'nsec' | 'npub'>('nsec')

  async function handlePasteNsec() {
    try {
      const text = await Clipboard.getStringAsync()
      if (!text?.trim()) {
        toast.error(t('watchonly.error.emptyClipboard'))
        return
      }
      setNsec(text.trim())
      toast.success(t('common.success.dataPasted'))
    } catch {
      toast.error(t('watchonly.error.clipboardPaste'))
    }
  }

  async function handlePasteNpub() {
    try {
      const text = await Clipboard.getStringAsync()
      if (!text?.trim()) {
        toast.error(t('watchonly.error.emptyClipboard'))
        return
      }
      setNpub(text.trim())
      toast.success(t('common.success.dataPasted'))
    } catch {
      toast.error(t('watchonly.error.clipboardPaste'))
    }
  }

  function handleQRScanned(content: DetectedContent) {
    const value = content.cleaned || content.raw || ''
    if (scanTarget === 'nsec') {
      setNsec(value)
    } else {
      setNpub(value)
    }
    setCameraVisible(false)
    toast.success(t('common.success.qrScanned'))
  }

  function handleMnemonicValid(mnemonic: string) {
    setValidMnemonic(mnemonic)
  }

  function handleMnemonicInvalid() {
    setValidMnemonic(null)
  }

  function handleImportNsec() {
    const trimmed = nsec.trim()
    if (!trimmed.startsWith('nsec1')) {
      toast.error(t('nostrIdentity.import.invalidNsec'))
      return
    }

    const derivedNpub = npubFromNsec(trimmed)
    if (!derivedNpub) {
      toast.error(t('nostrIdentity.import.invalidNsec'))
      return
    }

    addIdentity({
      createdAt: Date.now(),
      isWatchOnly: false,
      npub: derivedNpub,
      nsec: trimmed
    })

    toast.success(t('nostrIdentity.import.success'))
    router.navigate('/signer/nostr')
  }

  function handleImportSeedWords() {
    if (!validMnemonic) {
      return
    }

    try {
      const keys = deriveNostrKeysFromMnemonic(validMnemonic)
      addIdentity({
        createdAt: Date.now(),
        isWatchOnly: false,
        mnemonic: validMnemonic,
        npub: keys.npub,
        nsec: keys.nsec
      })

      toast.success(t('nostrIdentity.import.success'))
      router.navigate('/signer/nostr')
    } catch {
      toast.error(t('nostrIdentity.import.derivationError'))
    }
  }

  function handleImportNpub() {
    const trimmed = npub.trim()
    if (!trimmed.startsWith('npub1') || trimmed.length < 60) {
      toast.error(t('nostrIdentity.import.invalidNpub'))
      return
    }

    addIdentity({
      createdAt: Date.now(),
      isWatchOnly: true,
      npub: trimmed
    })

    toast.success(t('nostrIdentity.import.success'))
    router.navigate('/signer/nostr')
  }

  function renderScene({
    route
  }: SceneRendererProps & { route: { key: string } }) {
    switch (route.key) {
      case 'nsec':
        return (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <SSVStack gap="lg" style={styles.tabContent}>
              <SSVStack gap="xs">
                <SSText size="sm" color="muted" uppercase>
                  {t('nostrIdentity.import.nsecLabel')}
                </SSText>
                <SSTextInput
                  placeholder="nsec1..."
                  value={nsec}
                  onChangeText={setNsec}
                  align="left"
                  autoCapitalize="none"
                  secureTextEntry
                />
              </SSVStack>
              <SSHStack gap="sm" style={{ width: '100%' }}>
                <SSButton
                  label={t('common.paste')}
                  variant="outline"
                  onPress={handlePasteNsec}
                  style={{ flex: 1 }}
                />
                <SSButton
                  label={t('common.scanQR')}
                  variant="outline"
                  onPress={() => {
                    setScanTarget('nsec')
                    setCameraVisible(true)
                  }}
                  style={{ flex: 1 }}
                />
              </SSHStack>
              <SSButton
                label={t('nostrIdentity.import.importButton')}
                variant="secondary"
                onPress={handleImportNsec}
                disabled={!nsec.trim().startsWith('nsec1')}
              />
            </SSVStack>
          </ScrollView>
        )
      case 'seedWords':
        return (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.tabContent}
          >
            <SSSeedWordsInput
              wordCount={12}
              wordListName="english"
              network={'testnet' as unknown as Network}
              onMnemonicValid={handleMnemonicValid}
              onMnemonicInvalid={handleMnemonicInvalid}
              showPasteButton
              showScanSeedQRButton
              showActionButton
              actionButtonLabel={t('nostrIdentity.import.importButton')}
              actionButtonVariant="secondary"
              onActionButtonPress={handleImportSeedWords}
              actionButtonDisabled={!validMnemonic}
              showCancelButton={false}
              autoCheckClipboard={false}
            />
          </ScrollView>
        )
      case 'npub':
        return (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <SSVStack gap="lg" style={styles.tabContent}>
              <SSVStack gap="xs">
                <SSText size="sm" color="muted" uppercase>
                  {t('nostrIdentity.import.npubLabel')}
                </SSText>
                <SSTextInput
                  placeholder="npub1..."
                  value={npub}
                  onChangeText={setNpub}
                  align="left"
                  autoCapitalize="none"
                />
                <SSText size="xs" color="muted">
                  {t('nostrIdentity.import.npubHint')}
                </SSText>
              </SSVStack>
              <SSHStack gap="sm" style={{ width: '100%' }}>
                <SSButton
                  label={t('common.paste')}
                  variant="outline"
                  onPress={handlePasteNpub}
                  style={{ flex: 1 }}
                />
                <SSButton
                  label={t('common.scanQR')}
                  variant="outline"
                  onPress={() => {
                    setScanTarget('npub')
                    setCameraVisible(true)
                  }}
                  style={{ flex: 1 }}
                />
              </SSHStack>
              <SSButton
                label={t('nostrIdentity.import.importButton')}
                variant="secondary"
                onPress={handleImportNpub}
                disabled={!npub.trim().startsWith('npub1')}
              />
            </SSVStack>
          </ScrollView>
        )
      default:
        return null
    }
  }

  function renderTabBar() {
    const tabWidth = `${100 / ROUTES.length}%` as const

    return (
      <SSHStack gap="none" style={styles.tabBar}>
        {ROUTES.map((route, i) => (
          <SSActionButton
            key={route.key}
            style={[styles.tabButton, { width: tabWidth }]}
            onPress={() => setTabIndex(i)}
          >
            <View style={styles.tabButtonWrap}>
              <SSVStack gap="none" itemsCenter style={styles.tabButtonInner}>
                <SSText
                  size="sm"
                  uppercase
                  center
                  color={tabIndex === i ? 'white' : 'muted'}
                >
                  {route.title}
                </SSText>
              </SSVStack>
              {tabIndex === i ? <View style={styles.tabIndicator} /> : null}
            </View>
          </SSActionButton>
        ))}
      </SSHStack>
    )
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <SSText uppercase>{t('nostrIdentity.import.title')}</SSText>
          )
        }}
      />
      <TabView
        navigationState={{ index: tabIndex, routes: ROUTES }}
        renderScene={renderScene}
        renderTabBar={renderTabBar}
        onIndexChange={setTabIndex}
        initialLayout={{ width: layout.width }}
      />
      <SSCameraModal
        context="nostr"
        visible={cameraVisible}
        onClose={() => setCameraVisible(false)}
        onContentScanned={handleQRScanned}
      />
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    borderBottomColor: Colors.gray[800],
    borderBottomWidth: 1,
    paddingVertical: 0
  },
  tabButton: {
    height: 48
  },
  tabButtonInner: {
    flex: 1,
    justifyContent: 'center',
    width: '100%'
  },
  tabButtonWrap: {
    flex: 1,
    height: '100%',
    position: 'relative',
    width: '100%'
  },
  tabContent: {
    paddingTop: 20
  },
  tabIndicator: {
    backgroundColor: Colors.white,
    bottom: -1,
    height: 2,
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 1
  }
})
