import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { SSIconAdd, SSIconGreen, SSIconGreenNoSecret } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSRadioButton from '@/components/SSRadioButton'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { useKeySourceLabel } from '@/hooks/useKeySourceLabel'
import { useMultisigKeyValidation } from '@/hooks/useKeyValidation'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import type { Key, Secret } from '@/types/models/Account'
import { getExtendedKeyFromDescriptor } from '@/utils/bip32'

type SSMultisigKeyControlProps = {
  index: number
  keyCount: number
  keyDetails?: Key
  isSettingsMode?: boolean
  accountId?: string
}

function SSMultisigKeyControl({
  index,
  keyCount,
  keyDetails,
  isSettingsMode = false,
  accountId
}: SSMultisigKeyControlProps) {
  const router = useRouter()
  const [
    setKeyName,
    setCreationType,
    setNetwork,
    getAccountData,
    resetKey,
    dropSeedFromKey,
    setMnemonicWordCount,
    globalScriptVersion
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.setKeyName,
      state.setCreationType,
      state.setNetwork,
      state.getAccountData,
      state.resetKey,
      state.dropSeedFromKey,
      state.setMnemonicWordCount,
      state.scriptVersion
    ])
  )
  const [updateKeyName, resetKeyExisting, dropSeedFromKeyExisting] =
    useAccountsStore(
      useShallow((state) => [
        state.updateKeyName,
        state.resetKey,
        state.dropSeedFromKey
      ])
    )
  const network = useBlockchainStore((state) => state.selectedNetwork)

  // Use account's script version in settings mode, global script version in creation mode
  const scriptVersion =
    isSettingsMode && keyDetails?.scriptVersion
      ? keyDetails.scriptVersion
      : globalScriptVersion

  const [isExpanded, setIsExpanded] = useState(false)
  const [localKeyName, setLocalKeyName] = useState(keyDetails?.name || '')
  const [extractedPublicKey, setExtractedPublicKey] = useState('')
  const [seedDropped, setSeedDropped] = useState(false)
  const [dropSeedModalVisible, setDropSeedModalVisible] = useState(false)
  const [resetKeyModalVisible, setResetKeyModalVisible] = useState(false)
  const [wordCountModalVisible, setWordCountModalVisible] = useState(false)
  const [localMnemonicWordCount, setLocalMnemonicWordCount] = useState(24)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const animatedHeight = useSharedValue(0)
  const animatedOpacity = useSharedValue(0)
  const [contentHeight, setContentHeight] = useState(0)

  useEffect(() => {
    if (isExpanded) {
      const targetHeight = contentHeight > 0 ? contentHeight : 300
      animatedHeight.set(withTiming(targetHeight + 50 - 16, { duration: 100 }))
      animatedOpacity.set(withTiming(1, { duration: 100 }))
    } else {
      animatedHeight.set(withTiming(0, { duration: 100 }))
      animatedOpacity.set(withTiming(0, { duration: 100 }))
    }
  }, [isExpanded, contentHeight, animatedHeight, animatedOpacity])

  const expandStyle = useAnimatedStyle(() => ({
    height: animatedHeight.value,
    opacity: animatedOpacity.value,
    overflow: 'hidden' as const
  }))

  // Extract public key from descriptor when key details change
  useEffect(() => {
    function extractPublicKey() {
      if (!keyDetails || typeof keyDetails.secret !== 'object') {
        setExtractedPublicKey('')
        return
      }

      const secret = keyDetails.secret as Secret

      // If we already have an extended public key, use it
      if (secret.extendedPublicKey) {
        setExtractedPublicKey(secret.extendedPublicKey)
        return
      }

      // If we have a descriptor, extract the public key from it
      if (secret.externalDescriptor) {
        const publicKey = getExtendedKeyFromDescriptor(
          secret.externalDescriptor
        )
        setExtractedPublicKey(publicKey)
      } else {
        setExtractedPublicKey('')
      }
    }

    extractPublicKey()
  }, [keyDetails])

  // Reset seedDropped when keyDetails changes (for settings mode)
  useEffect(() => {
    if (keyDetails && typeof keyDetails.secret === 'object') {
      // If the key has a mnemonic, reset seedDropped to false
      if (keyDetails.secret.mnemonic) {
        setSeedDropped(false)
      } else {
        setSeedDropped(true)
      }
    }
  }, [keyDetails])

  // Reset localKeyName and hasUnsavedChanges when keyDetails change
  useEffect(() => {
    if (keyDetails?.name !== undefined) {
      setLocalKeyName(keyDetails.name)
      setHasUnsavedChanges(false)
    }
  }, [keyDetails?.name])

  // Use custom hooks for label generation and validation
  const { sourceLabel, importExtendedLabel, dropSeedLabel, shareXpubLabel } =
    useKeySourceLabel({
      keyDetails,
      network,
      scriptVersion,
      seedDropped
    })

  const { isKeyCompleted, hasSeed, hasNoSecret } = useMultisigKeyValidation({
    keyDetails,
    seedDropped
  })

  function handleWordCountSelection() {
    setWordCountModalVisible(false)
    setMnemonicWordCount(
      localMnemonicWordCount as NonNullable<Key['mnemonicWordCount']>
    )
    router.navigate(`/signer/bitcoin/account/add/import/mnemonic/${index}`)
  }

  function handleAction(type: NonNullable<Key['creationType']>) {
    if (!localKeyName.trim()) {
      return
    }

    setCreationType(type)
    setKeyName(localKeyName)
    setNetwork(network)

    if (type === 'generateMnemonic') {
      router.navigate(
        `/signer/bitcoin/account/add/multiSig/keySettings/${index}`
      )
    } else if (type === 'importMnemonic') {
      setWordCountModalVisible(true)
    } else if (type === 'importDescriptor') {
      router.navigate(
        `/signer/bitcoin/account/add/(common)/import/descriptor/${index}`
      )
    } else if (type === 'importExtendedPub') {
      router.navigate(
        `/signer/bitcoin/account/add/(common)/import/extendedPub/${index}`
      )
    }
  }

  function handleCompletedKeyAction(
    action: 'dropSeed' | 'shareXpub' | 'shareDescriptor' | 'resetKey'
  ) {
    // Handle actions for completed keys
    switch (action) {
      case 'dropSeed':
        setDropSeedModalVisible(true)
        break
      case 'shareXpub':
        handleShareXpub()
        break
      case 'shareDescriptor':
        handleShareDescriptor()
        break
      case 'resetKey':
        setResetKeyModalVisible(true)
        break
      default:
        break
    }
  }

  function handleDropSeed() {
    if (!keyDetails) {
      return
    }

    try {
      if (isSettingsMode && accountId) {
        dropSeedFromKeyExisting(accountId, index)
      } else {
        dropSeedFromKey(index)
      }
      setSeedDropped(true)
    } catch {
      toast.error(t('account.seed.dropSeedError'))
    }
  }

  function handleResetKey() {
    if (!keyDetails) {
      return
    }

    try {
      if (isSettingsMode && accountId) {
        resetKeyExisting(accountId, index)
      } else {
        resetKey(index)
      }
      setLocalKeyName('')
      setExtractedPublicKey('')
      setSeedDropped(false)
      toast.error('Key has been reset')
    } catch {
      toast.error('Failed to reset key')
    }
  }

  function handleShareXpub() {
    if (accountId) {
      // In settings mode, use the existing account
      router.navigate(
        `/signer/bitcoin/account/${accountId}/settings/export/publicKey?keyIndex=${index}`
      )
    } else {
      // In creation mode, use account builder store data
      const accountData = getAccountData()
      const key = accountData.keys[index]

      if (!key) {
        toast.error('Key not found')
        return
      }

      // Navigate to a temporary export page that works with account builder data
      router.navigate(
        `/signer/bitcoin/account/add/multiSig/export/publicKey?keyIndex=${index}`
      )
    }
  }

  function handleShareDescriptor() {
    if (accountId) {
      // In settings mode, use the existing account
      router.navigate(
        `/signer/bitcoin/account/${accountId}/settings/export/descriptor?keyIndex=${index}`
      )
    } else {
      // In creation mode, use account builder store data
      const accountData = getAccountData()
      const key = accountData.keys[index]

      if (!key) {
        toast.error('Key not found')
        return
      }

      // Navigate to a temporary export page that works with account builder data
      router.navigate(
        `/signer/bitcoin/account/add/multiSig/export/descriptor?keyIndex=${index}`
      )
    }
  }

  function handleViewSeedWords() {
    if (accountId) {
      // In settings mode, use the existing account
      router.navigate(
        `/signer/bitcoin/account/${accountId}/settings/export/seedWords?keyIndex=${index}`
      )
    } else {
      // In creation mode, use account builder store data
      const accountData = getAccountData()
      const key = accountData.keys[index]

      if (!key) {
        toast.error('Key not found')
        return
      }

      // Navigate to a temporary export page that works with account builder data
      router.navigate(
        `/signer/bitcoin/account/add/multiSig/export/seedWords?keyIndex=${index}`
      )
    }
  }

  function handleKeyNameChange(newName: string) {
    setLocalKeyName(newName)
    setHasUnsavedChanges(true)
  }

  function handleSaveKeyName() {
    if (isSettingsMode && accountId && localKeyName.trim()) {
      updateKeyName(accountId, index, localKeyName.trim())
      setHasUnsavedChanges(false)
      toast.success('Key name saved')
    }
  }

  if (typeof keyDetails?.secret === 'string' && !isSettingsMode) {
    return null
  }

  // Extract fingerprint and extendedPublicKey for display, with null checks
  const fingerprint =
    (typeof keyDetails?.secret === 'object' && keyDetails.secret.fingerprint) ||
    keyDetails?.fingerprint ||
    ''

  // Use the extracted public key from state, or fall back to direct access
  const extendedPublicKey =
    extractedPublicKey ||
    (typeof keyDetails?.secret === 'object' &&
      keyDetails.secret.extendedPublicKey) ||
    ''

  // Format public key for display: first 7, last 4 chars
  let formattedPubKey = extendedPublicKey
  if (extendedPublicKey && extendedPublicKey.length > 12) {
    formattedPubKey = `${extendedPublicKey.slice(
      0,
      7
    )}...${extendedPublicKey.slice(-4)}`
  }

  return (
    <View
      style={[
        {
          borderColor: '#444444',
          borderTopWidth: 1,
          paddingBottom: 16,
          paddingTop: 16
        },
        index === keyCount - 1 && { borderBottomWidth: 1 }
      ]}
    >
      <TouchableOpacity
        onPress={() => {
          setIsExpanded(!isExpanded)
        }}
        style={{
          paddingBottom: 8,
          paddingTop: 8
        }}
      >
        <SSHStack justifyBetween>
          <SSHStack style={{ alignItems: 'center' }} gap="sm">
            {keyDetails ? (
              hasNoSecret ? (
                <SSIconGreenNoSecret width={24} height={24} />
              ) : (
                <SSIconGreen width={24} height={24} />
              )
            ) : (
              <SSIconAdd width={24} height={24} />
            )}
            <SSText color="muted" size="lg" style={{ paddingHorizontal: 10 }}>
              {t('common.key')} {index + 1}
            </SSText>
            <SSVStack gap="none">
              <SSText color="muted">{sourceLabel}</SSText>
              <SSText color={keyDetails?.name ? 'white' : 'muted'}>
                {keyDetails?.name ?? t('account.seed.noLabel')}
              </SSText>
            </SSVStack>
          </SSHStack>
          <SSVStack gap="none" style={{ alignItems: 'flex-end' }}>
            <SSText color={fingerprint ? 'white' : 'muted'}>
              {fingerprint || t('account.fingerprint')}
            </SSText>
            <SSText
              color={extendedPublicKey ? 'white' : 'muted'}
              selectable
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {formattedPubKey || t('account.seed.publicKey')}
            </SSText>
          </SSVStack>
        </SSHStack>
      </TouchableOpacity>

      <Animated.View style={expandStyle}>
        {/* Hidden content for measurement - always rendered but invisible */}
        <View
          style={{
            left: 0,
            opacity: 0,
            position: 'absolute',
            right: 0,
            top: -10000 // Move off-screen
          }}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout
            setContentHeight(height)
          }}
        >
          <SSVStack style={{ paddingBottom: 24, paddingTop: 16 }} gap="lg">
            {(!isKeyCompleted || isSettingsMode) && (
              <SSFormLayout>
                <SSFormLayout.Item>
                  <SSFormLayout.Label
                    label={t('account.participant.keyName')}
                  />
                  <SSTextInput
                    value={localKeyName}
                    onChangeText={handleKeyNameChange}
                  />
                  {isSettingsMode && hasUnsavedChanges && (
                    <SSButton
                      label={t('common.save')}
                      variant="secondary"
                      onPress={handleSaveKeyName}
                      style={{ marginTop: 8 }}
                    />
                  )}
                </SSFormLayout.Item>
              </SSFormLayout>
            )}
            <SSVStack gap="sm">
              {isKeyCompleted ? (
                <>
                  {hasSeed && (
                    <SSButton
                      label={t('account.seed.viewSeedWords')}
                      onPress={handleViewSeedWords}
                      variant="secondary"
                    />
                  )}
                  {hasSeed && (
                    <SSButton
                      label={dropSeedLabel}
                      onPress={() => handleCompletedKeyAction('dropSeed')}
                      style={{
                        backgroundColor: 'black',
                        borderColor: 'white',
                        borderWidth: 1
                      }}
                    />
                  )}
                  <SSButton
                    label={shareXpubLabel}
                    onPress={() => handleCompletedKeyAction('shareXpub')}
                  />
                  <SSButton
                    label={t('account.seed.shareDescriptor')}
                    onPress={() => handleCompletedKeyAction('shareDescriptor')}
                  />
                  <SSButton
                    label="Reset Key"
                    onPress={() => handleCompletedKeyAction('resetKey')}
                    variant="ghost"
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: '#666666',
                      borderWidth: 1
                    }}
                  />
                </>
              ) : (
                <>
                  <SSButton
                    label={t('account.generate.newSecretSeed')}
                    disabled={!localKeyName.trim()}
                    onPress={() => handleAction('generateMnemonic')}
                  />
                  <SSButton
                    label={t('account.import.title2')}
                    disabled={!localKeyName.trim()}
                    onPress={() => handleAction('importMnemonic')}
                  />
                  <SSButton
                    label={t('account.import.descriptor')}
                    disabled={!localKeyName.trim()}
                    onPress={() => handleAction('importDescriptor')}
                  />
                  <SSButton
                    label={importExtendedLabel}
                    disabled={!localKeyName.trim()}
                    onPress={() => handleAction('importExtendedPub')}
                  />
                </>
              )}
            </SSVStack>
          </SSVStack>
        </View>
        {/* Visible content - same as hidden measurement content */}
        <SSVStack style={{ paddingBottom: 24, paddingTop: 16 }} gap="lg">
          {(!isKeyCompleted || isSettingsMode) && (
            <SSFormLayout>
              <SSFormLayout.Item>
                <SSFormLayout.Label label={t('account.participant.keyName')} />
                <SSTextInput
                  value={localKeyName}
                  onChangeText={handleKeyNameChange}
                />
                {isSettingsMode && hasUnsavedChanges && (
                  <SSButton
                    label={t('common.save')}
                    variant="secondary"
                    onPress={handleSaveKeyName}
                    style={{ marginTop: 8 }}
                  />
                )}
              </SSFormLayout.Item>
            </SSFormLayout>
          )}

          <SSVStack gap="sm">
            {isKeyCompleted ? (
              <>
                {hasSeed && (
                  <SSButton
                    label={t('account.seed.viewSeedWords')}
                    onPress={handleViewSeedWords}
                    variant="secondary"
                  />
                )}
                {hasSeed && (
                  <SSButton
                    label={dropSeedLabel}
                    onPress={() => handleCompletedKeyAction('dropSeed')}
                    style={{
                      backgroundColor: 'black',
                      borderColor: 'white',
                      borderWidth: 1
                    }}
                  />
                )}
                <SSButton
                  label={shareXpubLabel}
                  onPress={() => handleCompletedKeyAction('shareXpub')}
                />
                <SSButton
                  label={t('account.seed.shareDescriptor')}
                  onPress={() => handleCompletedKeyAction('shareDescriptor')}
                />
                <SSButton
                  label="Reset Key"
                  onPress={() => handleCompletedKeyAction('resetKey')}
                  variant="ghost"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: '#666666',
                    borderWidth: 1
                  }}
                />
              </>
            ) : (
              <>
                <SSButton
                  label={t('account.generate.newSecretSeed')}
                  disabled={!localKeyName.trim()}
                  onPress={() => handleAction('generateMnemonic')}
                />
                <SSButton
                  label={t('account.import.title2')}
                  disabled={!localKeyName.trim()}
                  onPress={() => handleAction('importMnemonic')}
                />
                <SSButton
                  label={t('account.import.descriptor')}
                  disabled={!localKeyName.trim()}
                  onPress={() => handleAction('importDescriptor')}
                />
                <SSButton
                  label={importExtendedLabel}
                  disabled={!localKeyName.trim()}
                  onPress={() => handleAction('importExtendedPub')}
                />
              </>
            )}
          </SSVStack>
        </SSVStack>
      </Animated.View>

      {/* Drop Seed Confirmation Modal */}
      <SSModal
        visible={dropSeedModalVisible}
        onClose={() => setDropSeedModalVisible(false)}
        label=""
      >
        <SSVStack
          itemsCenter
          gap="lg"
          style={{
            backgroundColor: Colors.white,
            borderRadius: 8,
            boxShadow: '0 2px 3.84px rgba(0, 0, 0, 0.25)',
            marginHorizontal: 40,
            maxWidth: 300,
            paddingHorizontal: 16,
            paddingVertical: 20
          }}
        >
          {/* Title */}
          <SSText
            size="lg"
            weight="bold"
            center
            style={{ color: Colors.black, marginBottom: 4 }}
          >
            {t('account.seed.dropSeedConfirm.title')}
          </SSText>

          {/* Message */}
          <SSText
            color="muted"
            center
            size="md"
            style={{
              lineHeight: 20,
              marginBottom: 8,
              maxWidth: 260
            }}
          >
            {t('account.seed.dropSeedConfirm.message')}
          </SSText>

          {/* Action Buttons */}
          <SSHStack gap="sm" style={{ width: '100%' }}>
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => setDropSeedModalVisible(false)}
              style={{
                backgroundColor: Colors.gray[100],
                borderWidth: 0,
                flex: 1
              }}
              textStyle={{ color: Colors.black }}
            />
            <SSButton
              label={t('account.seed.dropSeedConfirm.confirm')}
              variant="danger"
              onPress={() => {
                setDropSeedModalVisible(false)
                handleDropSeed()
              }}
              style={{ flex: 1 }}
            />
          </SSHStack>
        </SSVStack>
      </SSModal>
      <SSModal
        visible={resetKeyModalVisible}
        onClose={() => setResetKeyModalVisible(false)}
        label=""
      >
        <SSVStack
          itemsCenter
          gap="lg"
          style={{
            backgroundColor: Colors.white,
            borderRadius: 8,
            boxShadow: '0 2px 3.84px rgba(0, 0, 0, 0.25)',
            marginHorizontal: 40,
            maxWidth: 300,
            paddingHorizontal: 16,
            paddingVertical: 20
          }}
        >
          {/* Title */}
          <SSText
            size="lg"
            weight="bold"
            center
            style={{ color: Colors.black, marginBottom: 4 }}
          >
            Reset Key
          </SSText>

          {/* Message */}
          <SSText
            color="muted"
            center
            size="md"
            style={{
              lineHeight: 20,
              marginBottom: 8,
              maxWidth: 260
            }}
          >
            Are you sure you want to reset this key? This will clear all key
            data including the seed, name, and settings. This action cannot be
            undone.
          </SSText>
          <SSHStack gap="sm" style={{ width: '100%' }}>
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => setResetKeyModalVisible(false)}
              style={{
                backgroundColor: Colors.gray[100],
                borderWidth: 0,
                flex: 1
              }}
              textStyle={{ color: Colors.black }}
            />
            <SSButton
              label="Reset Key"
              variant="danger"
              onPress={() => {
                setResetKeyModalVisible(false)
                handleResetKey()
              }}
              style={{ flex: 1 }}
            />
          </SSHStack>
        </SSVStack>
      </SSModal>
      <SSSelectModal
        visible={wordCountModalVisible}
        title={t('account.mnemonic.title')}
        selectedText={`${localMnemonicWordCount} ${t('bitcoin.words')}`}
        selectedDescription={t(`account.mnemonic.${localMnemonicWordCount}`)}
        onSelect={handleWordCountSelection}
        onCancel={() => setWordCountModalVisible(false)}
      >
        {([24, 21, 18, 15, 12] as const).map((count) => (
          <SSRadioButton
            key={count}
            label={`${count} ${t('bitcoin.words').toLowerCase()}`}
            selected={localMnemonicWordCount === count}
            onPress={() => setLocalMnemonicWordCount(count)}
          />
        ))}
      </SSSelectModal>
    </View>
  )
}

export default SSMultisigKeyControl
