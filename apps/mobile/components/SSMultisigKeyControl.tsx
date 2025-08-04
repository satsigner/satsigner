import { Descriptor } from 'bdk-rn'
import { type Network } from 'bdk-rn/lib/lib/enums'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, TouchableOpacity, View } from 'react-native'
import { toast } from 'sonner-native'
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
import {
  type Key,
  type ScriptVersionType,
  type Secret
} from '@/types/models/Account'
import { getKeyFormatForScriptVersion } from '@/utils/bitcoin'
import { aesDecrypt, aesEncrypt } from '@/utils/crypto'

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
  const updateAccountName = useAccountsStore((state) => state.updateAccountName)
  const updateAccount = useAccountsStore((state) => state.updateAccount)

  // Use account's script version in settings mode, global script version in creation mode
  const scriptVersion =
    isSettingsMode && keyDetails?.scriptVersion
      ? keyDetails.scriptVersion
      : globalScriptVersion

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
        } catch (_error) {
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
    // Fallback to global script version
    const keyFormat = getKeyFormatForScriptVersion(scriptVersion, network)
    return t(`account.seed.dropAndKeep.${keyFormat}`)
  }

  function getShareXpubLabel() {
    // Fallback to global script version
    const keyFormat = getKeyFormatForScriptVersion(scriptVersion, network)
    return t(
      `account.seed.share${
        keyFormat.charAt(0).toUpperCase() + keyFormat.slice(1)
      }`
    )
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

    // Show confirmation dialog
    Alert.alert(
      t('account.seed.dropSeedConfirm.title'),
      t('account.seed.dropSeedConfirm.message'),
      [
        {
          text: t('common.cancel'),
          style: 'cancel'
        },
        {
          text: t('account.seed.dropSeedConfirm.confirm'),
          style: 'destructive',
          onPress: async () => {
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
                internalDescriptor: decryptedSecret.internalDescriptor,
                fingerprint: decryptedSecret.fingerprint // Preserve fingerprint
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

              toast.success(t('account.seed.dropSeedSuccess'))
              onRefresh?.()
            } catch (_error) {
              toast.error(t('account.seed.dropSeedError'))
            }
          }
        }
      ]
    )
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

  function handleKeyNameChange(newName: string) {
    setLocalKeyName(newName)

    // Save to store if in settings mode and we have an account ID
    if (isSettingsMode && accountId && newName.trim()) {
      updateAccountName(accountId, newName.trim())
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
