import { Descriptor } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { extractExtendedKeyFromDescriptor } from '@/api/bdk'
import { SSIconAdd, SSIconGreen } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSModal from '@/components/SSModal'
import SSRadioButton from '@/components/SSRadioButton'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { Colors } from '@/styles'
import {
  type Key,
  type ScriptVersionType,
  type Secret
} from '@/types/models/Account'
import { getKeyFormatForScriptVersion } from '@/utils/bitcoin'

type SSMultisigKeyControlProps = {
  isBlackBackground: boolean
  index: number
  keyCount: number
  keyDetails?: Key
  isSettingsMode?: boolean
  accountId?: string
}

function SSMultisigKeyControl({
  isBlackBackground,
  index,
  keyCount,
  keyDetails,
  isSettingsMode = false,
  accountId
}: SSMultisigKeyControlProps) {
  const router = useRouter()
  const [setKeyName, setCreationType, setNetwork, getAccountData] =
    useAccountBuilderStore(
      useShallow((state) => [
        state.setKeyName,
        state.setCreationType,
        state.setNetwork,
        state.getAccountData
      ])
    )
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const globalScriptVersion = useAccountBuilderStore(
    (state) => state.scriptVersion
  ) as ScriptVersionType
  const updateKeyName = useAccountsStore((state) => state.updateKeyName)

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
  const [wordCountModalVisible, setWordCountModalVisible] = useState(false)
  const [localMnemonicWordCount, setLocalMnemonicWordCount] = useState(24)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Extract public key from descriptor when key details change
  useEffect(() => {
    async function extractPublicKey() {
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
        try {
          const network = useBlockchainStore.getState().selectedNetwork
          const descriptor = await new Descriptor().create(
            secret.externalDescriptor,
            network as Network
          )
          const publicKey = await extractExtendedKeyFromDescriptor(descriptor)
          setExtractedPublicKey(publicKey)
        } catch (_error) {
          setExtractedPublicKey('')
        }
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

  function getSourceLabel() {
    if (!keyDetails) {
      return t('account.selectKeySource')
    } else if (keyDetails.creationType === 'generateMnemonic') {
      // Check if seed has been dropped
      if (
        seedDropped ||
        (typeof keyDetails.secret === 'object' && !keyDetails.secret.mnemonic)
      ) {
        return t('account.seed.droppedSeed', {
          name: keyDetails.scriptVersion
        })
      }
      return t('account.seed.newSeed', {
        name: keyDetails.scriptVersion
      })
    } else if (keyDetails.creationType === 'importMnemonic') {
      // Check if seed has been dropped
      if (
        seedDropped ||
        (typeof keyDetails.secret === 'object' && !keyDetails.secret.mnemonic)
      ) {
        return t('account.seed.droppedSeed', {
          name: keyDetails.scriptVersion
        })
      }
      return t('account.seed.importedSeed', { name: keyDetails.scriptVersion })
    } else if (keyDetails.creationType === 'importDescriptor') {
      return t('account.seed.external')
    } else if (keyDetails.creationType === 'importExtendedPub') {
      // Show the correct label according to the script version and network
      const keyFormat = getKeyFormatForScriptVersion(scriptVersion, network)
      return t(`account.import.${keyFormat}`)
    }
  }

  // Always use the global scriptVersion from the store
  function getImportExtendedLabel() {
    const keyFormat = getKeyFormatForScriptVersion(scriptVersion, network)
    return t(`account.import.${keyFormat}`)
  }

  function getDropSeedLabel() {
    // For multisig, generate dynamic labels based on script type and network
    if (scriptVersion === 'P2SH') {
      return network === 'bitcoin'
        ? t('account.seed.dropAndKeep.xpub')
        : t('account.seed.dropAndKeep.tpub')
    } else if (scriptVersion === 'P2SH-P2WSH') {
      return network === 'bitcoin'
        ? t('account.seed.dropAndKeep.ypub')
        : t('account.seed.dropAndKeep.upub')
    } else if (scriptVersion === 'P2WSH') {
      return network === 'bitcoin'
        ? t('account.seed.dropAndKeep.zpub')
        : t('account.seed.dropAndKeep.vpub')
    } else if (scriptVersion === 'P2PKH') {
      // P2PKH: Only xpub/tpub
      return network === 'bitcoin'
        ? t('account.seed.dropAndKeep.xpub')
        : t('account.seed.dropAndKeep.tpub')
    } else if (scriptVersion === 'P2SH-P2WPKH') {
      // P2SH-P2WPKH: xpub/ypub or tpub/upub
      return network === 'bitcoin'
        ? t('account.seed.dropAndKeep.ypub')
        : t('account.seed.dropAndKeep.upub')
    } else if (scriptVersion === 'P2WPKH') {
      // P2WPKH: xpub/zpub or tpub/vpub
      return network === 'bitcoin'
        ? t('account.seed.dropAndKeep.zpub')
        : t('account.seed.dropAndKeep.vpub')
    } else if (scriptVersion === 'P2TR') {
      // P2TR: Only vpub (same for all networks)
      return t('account.seed.dropAndKeep.vpub')
    } else {
      // Fallback for other script types
      const keyFormat = getKeyFormatForScriptVersion(scriptVersion, network)
      return t(`account.seed.dropAndKeep.${keyFormat}`)
    }
  }

  function getShareXpubLabel() {
    // For multisig, generate dynamic labels based on script type and network
    if (scriptVersion === 'P2SH') {
      return network === 'bitcoin'
        ? t('account.seed.shareXpub')
        : t('account.seed.shareTpub')
    } else if (scriptVersion === 'P2SH-P2WSH') {
      return network === 'bitcoin'
        ? t('account.seed.shareYpub')
        : t('account.seed.shareUpub')
    } else if (scriptVersion === 'P2WSH') {
      return network === 'bitcoin'
        ? t('account.seed.shareZpub')
        : t('account.seed.shareVpub')
    } else if (scriptVersion === 'P2PKH') {
      // P2PKH: Only xpub/tpub
      return network === 'bitcoin'
        ? t('account.seed.shareXpub')
        : t('account.seed.shareTpub')
    } else if (scriptVersion === 'P2SH-P2WPKH') {
      // P2SH-P2WPKH: xpub/ypub or tpub/upub
      return network === 'bitcoin'
        ? t('account.seed.shareYpub')
        : t('account.seed.shareUpub')
    } else if (scriptVersion === 'P2WPKH') {
      // P2WPKH: xpub/zpub or tpub/vpub
      return network === 'bitcoin'
        ? t('account.seed.shareZpub')
        : t('account.seed.shareVpub')
    } else if (scriptVersion === 'P2TR') {
      // P2TR: Only vpub
      return t('account.seed.shareVpub')
    } else {
      // Fallback for other script types
      const keyFormat = getKeyFormatForScriptVersion(scriptVersion, network)
      return t(
        `account.seed.share${
          keyFormat.charAt(0).toUpperCase() + keyFormat.slice(1)
        }`
      )
    }
  }

  function handleWordCountSelection() {
    setWordCountModalVisible(false)
    // Set the word count in the account builder store
    const { setMnemonicWordCount } = useAccountBuilderStore.getState()
    setMnemonicWordCount(
      localMnemonicWordCount as NonNullable<Key['mnemonicWordCount']>
    )
    // Navigate to import page with the selected word count
    router.navigate(`/account/add/import/mnemonic/${index}`)
  }

  async function handleAction(type: NonNullable<Key['creationType']>) {
    if (!localKeyName.trim()) return

    setCreationType(type)
    setKeyName(localKeyName)
    // scriptVersion is set only in the initial policy selection and never changed here
    setNetwork(network)

    if (type === 'generateMnemonic') {
      // Navigate to each key policy type component
      router.navigate(`/account/add/multiSig/keySettings/${index}`)
    } else if (type === 'importMnemonic') {
      // For import, first show the word count selection modal
      setWordCountModalVisible(true)
    } else if (type === 'importDescriptor') {
      router.navigate(`/account/add/(common)/import/descriptor/${index}`)
    } else if (type === 'importExtendedPub') {
      router.navigate(`/account/add/(common)/import/extendedPub/${index}`)
    }
  }

  function handleCompletedKeyAction(
    action: 'dropSeed' | 'shareXpub' | 'shareDescriptor'
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
    }
  }

  async function handleDropSeed() {
    if (!keyDetails) return

    try {
      if (isSettingsMode && accountId) {
        // Handle existing account (settings mode) using the new dropSeedFromKey function
        const { dropSeedFromKey } = useAccountsStore.getState()
        const result = await dropSeedFromKey(accountId, index)

        if (result.success) {
          // Set seedDropped to true to hide the button
          setSeedDropped(true)
          toast.success(result.message)
          // Don't call onRefresh to keep the interface focused
        } else {
          toast.error(result.message)
        }
      } else {
        // Handle account creation mode
        const { dropSeedFromKey } = useAccountBuilderStore.getState()
        const result = await dropSeedFromKey(index)

        if (result.success) {
          toast.success(result.message)
          // Don't call onRefresh to keep the interface focused
        } else {
          toast.error(result.message)
        }
      }
    } catch (_error) {
      toast.error(t('account.seed.dropSeedError'))
    }
  }

  function handleShareXpub() {
    if (accountId) {
      // In settings mode, use the existing account
      router.navigate(
        `/account/${accountId}/settings/export/publicKey?keyIndex=${index}`
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
        `/account/add/multiSig/export/publicKey?keyIndex=${index}`
      )
    }
  }

  function handleShareDescriptor() {
    if (accountId) {
      // In settings mode, use the existing account
      router.navigate(
        `/account/${accountId}/settings/export/descriptor?keyIndex=${index}`
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
        `/account/add/multiSig/export/descriptor?keyIndex=${index}`
      )
    }
  }

  // Check if the key is completed based on its data
  const isKeyCompleted =
    keyDetails &&
    keyDetails.creationType &&
    ((typeof keyDetails.secret === 'object' &&
      keyDetails.secret.fingerprint &&
      (keyDetails.secret.extendedPublicKey ||
        keyDetails.secret.externalDescriptor ||
        keyDetails.secret.mnemonic)) ||
      (typeof keyDetails.secret === 'string' && keyDetails.secret.length > 0))

  // Check if the key has a mnemonic (seed) that can be dropped
  const hasSeed = Boolean(
    !seedDropped &&
      keyDetails &&
      typeof keyDetails.secret === 'object' &&
      keyDetails.secret.mnemonic
  )

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

  if (typeof keyDetails?.secret === 'string' && !isSettingsMode) return null

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
          borderColor: '#6A6A6A',
          borderTopWidth: 2,
          backgroundColor: isBlackBackground ? 'black' : '#1E1E1E'
        },
        index === keyCount - 1 && { borderBottomWidth: 2 }
      ]}
    >
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        style={{
          paddingHorizontal: 8,
          paddingBottom: 8,
          paddingTop: 8
        }}
      >
        <SSHStack justifyBetween>
          <SSHStack style={{ alignItems: 'center' }}>
            {keyDetails ? (
              <SSIconGreen width={24} height={24} />
            ) : (
              <SSIconAdd width={24} height={24} />
            )}
            <SSText color="muted" size="lg">
              {t('common.key')} {index + 1}
            </SSText>
            <SSVStack gap="none">
              <SSText>{getSourceLabel()}</SSText>
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

      {isExpanded && (
        <SSVStack style={{ paddingHorizontal: 8, paddingBottom: 8 }} gap="lg">
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
                    label={getDropSeedLabel()}
                    onPress={() => handleCompletedKeyAction('dropSeed')}
                    style={{
                      backgroundColor: 'black',
                      borderWidth: 1,
                      borderColor: 'white'
                    }}
                  />
                )}
                <SSButton
                  label={getShareXpubLabel()}
                  onPress={() => handleCompletedKeyAction('shareXpub')}
                />
                <SSButton
                  label={t('account.seed.shareDescriptor')}
                  onPress={() => handleCompletedKeyAction('shareDescriptor')}
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
                  label={getImportExtendedLabel()}
                  disabled={!localKeyName.trim()}
                  onPress={() => handleAction('importExtendedPub')}
                />
              </>
            )}
          </SSVStack>
        </SSVStack>
      )}

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
            paddingVertical: 20,
            paddingHorizontal: 16,
            backgroundColor: Colors.white,
            borderRadius: 8,
            marginHorizontal: 40,
            maxWidth: 300,
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: 2
            },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5
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
              maxWidth: 260,
              lineHeight: 20,
              marginBottom: 8
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
                flex: 1,
                backgroundColor: Colors.gray[100],
                borderWidth: 0
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

      {/* Word Count Selection Modal */}
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
