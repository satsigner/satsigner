import { useRouter } from 'expo-router'
import { useState, useEffect } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

import { extractExtendedKeyFromDescriptor } from '@/api/bdk'
import { SSIconAdd, SSIconGreen } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import { PIN_KEY } from '@/config/auth'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { getItem } from '@/storage/encrypted'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { type Key, type Secret } from '@/types/models/Account'
import { type ScriptVersionType } from '@/types/models/Account'
import { aesDecrypt, aesEncrypt } from '@/utils/crypto'
import { Descriptor } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'

type SSMultisigKeyControlProps = {
  isBlackBackground: boolean
  index: number
  keyCount: number
  keyDetails?: Key
  isSettingsMode?: boolean
  accountId?: string
  onRefresh?: () => void
}

function SSMultisigKeyControl({
  isBlackBackground,
  index,
  keyCount,
  keyDetails,
  isSettingsMode = false,
  accountId,
  onRefresh
}: SSMultisigKeyControlProps) {
  const router = useRouter()
  const [setKeyName, setCreationType, setNetwork] = useAccountBuilderStore(
    useShallow((state) => [
      state.setKeyName,
      state.setCreationType,
      state.setNetwork
    ])
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const scriptVersion = useAccountBuilderStore(
    (state) => state.scriptVersion
  ) as ScriptVersionType
  const updateAccountName = useAccountsStore((state) => state.updateAccountName)
  const updateAccount = useAccountsStore((state) => state.updateAccount)

  const [isExpanded, setIsExpanded] = useState(false)
  const [localKeyName, setLocalKeyName] = useState(keyDetails?.name || '')
  const [extractedPublicKey, setExtractedPublicKey] = useState('')

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
        } catch (error) {
          console.log('Failed to extract public key from descriptor:', error)
          setExtractedPublicKey('')
        }
      } else {
        setExtractedPublicKey('')
      }
    }

    extractPublicKey()
  }, [keyDetails])

  function getSourceLabel() {
    if (!keyDetails) {
      return t('account.selectKeySource')
    } else if (keyDetails.creationType === 'generateMnemonic') {
      return t('account.seed.newSeed', {
        name: keyDetails.scriptVersion
      })
    } else if (keyDetails.creationType === 'importMnemonic') {
      return t('account.seed.importedSeed', { name: keyDetails.scriptVersion })
    } else if (keyDetails.creationType === 'importDescriptor') {
      return t('account.seed.external')
    } else if (keyDetails.creationType === 'importExtendedPub') {
      // Show the correct label according to the global script version
      switch (scriptVersion) {
        case 'P2PKH':
          return t('account.import.xpub')
        case 'P2SH-P2WPKH':
          return t('account.import.ypub')
        case 'P2WPKH':
          return t('account.import.zpub')
        case 'P2TR':
          return t('account.import.vpub')
        default:
          return t('account.import.xpub')
      }
    }
  }

  // Always use the global scriptVersion from the store
  function getImportExtendedLabel() {
    switch (scriptVersion) {
      case 'P2PKH':
        return t('account.import.xpub')
      case 'P2SH-P2WPKH':
        return t('account.import.ypub')
      case 'P2WPKH':
        return t('account.import.zpub')
      case 'P2TR':
        return t('account.import.vpub')
      default:
        return t('account.import.xpub')
    }
  }

  function getDropSeedLabel() {
    // If we have an extended public key, use its prefix to determine the label
    if (extractedPublicKey) {
      if (
        extractedPublicKey.startsWith('xpub') ||
        extractedPublicKey.startsWith('tpub')
      ) {
        return t('account.seed.dropAndKeep.xpub')
      }
      if (extractedPublicKey.startsWith('ypub')) {
        return t('account.seed.dropAndKeep.ypub')
      }
      if (extractedPublicKey.startsWith('zpub')) {
        return t('account.seed.dropAndKeep.zpub')
      }
      if (extractedPublicKey.startsWith('vpub')) {
        return t('account.seed.dropAndKeep.vpub')
      }
    }

    // Fallback to global script version
    switch (scriptVersion) {
      case 'P2PKH':
        return t('account.seed.dropAndKeep.xpub')
      case 'P2SH-P2WPKH':
        return t('account.seed.dropAndKeep.ypub')
      case 'P2WPKH':
        return t('account.seed.dropAndKeep.zpub')
      case 'P2TR':
        return t('account.seed.dropAndKeep.vpub')
      default:
        return t('account.seed.dropAndKeep.xpub')
    }
  }

  function getShareXpubLabel() {
    // If we have an extended public key, use its prefix to determine the label
    if (extractedPublicKey) {
      if (
        extractedPublicKey.startsWith('xpub') ||
        extractedPublicKey.startsWith('tpub')
      ) {
        return t('account.seed.shareXpub')
      }
      if (extractedPublicKey.startsWith('ypub')) {
        return t('account.seed.shareYpub')
      }
      if (extractedPublicKey.startsWith('zpub')) {
        return t('account.seed.shareZpub')
      }
      if (extractedPublicKey.startsWith('vpub')) {
        return t('account.seed.shareVpub')
      }
    }

    // Fallback to global script version
    switch (scriptVersion) {
      case 'P2PKH':
        return t('account.seed.shareXpub')
      case 'P2SH-P2WPKH':
        return t('account.seed.shareYpub')
      case 'P2WPKH':
        return t('account.seed.shareZpub')
      case 'P2TR':
        return t('account.seed.shareVpub')
      default:
        return t('account.seed.shareXpub')
    }
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
      router.navigate(`/account/add/import/mnemonic/${index}`)
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
        handleDropSeed()
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
    if (!keyDetails || !accountId) return

    try {
      // Get the current account
      const accounts = useAccountsStore.getState().accounts
      const account = accounts.find((acc) => acc.id === accountId)
      if (!account) return

      const pin = await getItem(PIN_KEY)
      if (!pin) return

      // Decrypt the key's secret
      let decryptedSecret: Secret
      if (typeof keyDetails.secret === 'string') {
        const decryptedSecretString = await aesDecrypt(
          keyDetails.secret,
          pin,
          keyDetails.iv
        )
        decryptedSecret = JSON.parse(decryptedSecretString) as Secret
      } else {
        decryptedSecret = keyDetails.secret as Secret
      }

      // Remove mnemonic and passphrase, keep only extended public key and metadata
      const cleanedSecret: Secret = {
        extendedPublicKey: decryptedSecret.extendedPublicKey,
        externalDescriptor: decryptedSecret.externalDescriptor,
        internalDescriptor: decryptedSecret.internalDescriptor
      }

      // Re-encrypt the cleaned secret
      const stringifiedSecret = JSON.stringify(cleanedSecret)
      const encryptedSecret = await aesEncrypt(
        stringifiedSecret,
        pin,
        keyDetails.iv
      )

      // Update the account with the new encrypted secret
      const updatedAccount = { ...account }
      updatedAccount.keys[index] = {
        ...keyDetails,
        secret: encryptedSecret
      }

      // Update the account in the store
      await updateAccount(updatedAccount)

      onRefresh?.()
    } catch {
      // Handle error silently
    }
  }

  function handleShareXpub() {
    if (!accountId) return
    router.navigate(
      `/account/${accountId}/settings/export/shareXpub?keyIndex=${index}`
    )
  }

  function handleShareDescriptor() {
    if (!accountId) return

    router.navigate(
      `/account/${accountId}/settings/export/shareDescriptor?keyIndex=${index}`
    )
  }

  // Check if key is completed (has been created with necessary data)
  const isKeyCompleted = isSettingsMode
    ? true
    : keyDetails &&
      keyDetails.creationType &&
      keyDetails.fingerprint &&
      typeof keyDetails.secret === 'object' &&
      keyDetails.secret &&
      (keyDetails.secret.extendedPublicKey ||
        keyDetails.secret.externalDescriptor ||
        keyDetails.secret.mnemonic) &&
      // Ensure we have both fingerprint and public key/descriptor
      keyDetails.fingerprint.length > 0 &&
      ((keyDetails.secret.extendedPublicKey &&
        keyDetails.secret.extendedPublicKey.length > 0) ||
        (keyDetails.secret.externalDescriptor &&
          keyDetails.secret.externalDescriptor.length > 0) ||
        (keyDetails.secret.mnemonic && keyDetails.secret.mnemonic.length > 0))

  function handleKeyNameChange(newName: string) {
    setLocalKeyName(newName)

    // Save to store if in settings mode and we have an account ID
    if (isSettingsMode && accountId && newName.trim()) {
      updateAccountName(accountId, newName.trim())
    }
  }

  if (typeof keyDetails?.secret === 'string' && !isSettingsMode) return null

  // Extract fingerprint and extendedPublicKey for display, with null checks
  const fingerprint = keyDetails?.fingerprint || ''
  const extendedPublicKey =
    (typeof keyDetails?.secret === 'object' &&
      keyDetails.secret.extendedPublicKey) ||
    ''

  // Format public key for display: first 7, last 4 chars
  let formattedPubKey = extendedPublicKey
  if (extendedPublicKey && extendedPublicKey.length > 12) {
    formattedPubKey = `${extendedPublicKey.slice(0, 7)}...${extendedPublicKey.slice(-4)}`
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
              </SSFormLayout.Item>
            </SSFormLayout>
          )}

          <SSVStack gap="sm">
            {isKeyCompleted ? (
              <>
                <SSButton
                  label={getDropSeedLabel()}
                  onPress={() => handleCompletedKeyAction('dropSeed')}
                  style={{
                    backgroundColor: 'black',
                    borderWidth: 1,
                    borderColor: 'white'
                  }}
                />
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
    </View>
  )
}

export default SSMultisigKeyControl
