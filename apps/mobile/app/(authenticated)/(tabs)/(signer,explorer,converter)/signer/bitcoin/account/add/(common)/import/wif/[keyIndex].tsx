import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSScriptVersionModal from '@/components/SSScriptVersionModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import useAccountBuilderFinish from '@/hooks/useAccountBuilderFinish'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { useBlockchainStore } from '@/store/blockchain'
import { type ScriptVersionType } from '@/types/models/Script'
import { type ImportWifSearchParams } from '@/types/navigation/searchParams'
import {
  decodeWif,
  scriptVersionForWifImport,
  type WifDecodeResult,
  type WifScriptLimitReason,
  wifImportSecret,
  wifScriptLimits
} from '@/utils/wif'

function wifFieldError(text: string, result: WifDecodeResult) {
  if (!text.trim() || result.ok) {
    return
  }
  if (result.reason === 'network') {
    return t('account.import.wif.networkMismatch')
  }
  return t('account.import.wif.invalid')
}

function wifScriptReason(reason: WifScriptLimitReason) {
  if (reason === 'uncompressed') {
    return t('account.import.wif.script.uncompressed')
  }
  return t('account.import.wif.script.unsupported')
}

export default function ImportWif() {
  const { keyIndex } = useLocalSearchParams<ImportWifSearchParams>()
  const router = useRouter()
  const [
    name,
    scriptVersion,
    clearAccount,
    setCreationType,
    setScriptVersion,
    setExternalDescriptor,
    setPrivateKey,
    setKey,
    getAccountData,
    clearKeyState
  ] = useAccountBuilderStore(
    useShallow((state) => [
      state.name,
      state.scriptVersion,
      state.clearAccount,
      state.setCreationType,
      state.setScriptVersion,
      state.setExternalDescriptor,
      state.setPrivateKey,
      state.setKey,
      state.getAccountData,
      state.clearKeyState
    ])
  )
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const { accountBuilderFinish, loading } = useAccountBuilderFinish()
  const [wif, setWif] = useState('')
  const [scriptVersionModalVisible, setScriptVersionModalVisible] =
    useState(false)

  const decoded = decodeWif(wif, network)
  const limits = decoded.ok ? wifScriptLimits(decoded.compressed) : []
  const importScript = decoded.ok
    ? scriptVersionForWifImport(scriptVersion, decoded.compressed)
    : scriptVersion

  function handleWifChange(text: string) {
    setWif(text)
    const next = decodeWif(text, network)
    if (!next.ok) {
      return
    }
    const allowed = scriptVersionForWifImport(scriptVersion, next.compressed)
    if (allowed !== scriptVersion) {
      setScriptVersion(allowed)
    }
  }

  function handleSelectScript(next: ScriptVersionType) {
    setScriptVersion(next)
    setScriptVersionModalVisible(false)
  }

  async function handleImport() {
    if (!decoded.ok) {
      return
    }
    const secret = wifImportSecret(decoded, importScript)
    if (!secret?.externalDescriptor || !secret.privateKey) {
      toast.error(t('account.import.wif.invalid'))
      return
    }
    if (secret.privateKeyCompressed === undefined) {
      toast.error(t('account.import.wif.invalid'))
      return
    }

    setCreationType('importWif')
    setScriptVersion(importScript)
    setExternalDescriptor(secret.externalDescriptor)
    setPrivateKey(secret.privateKey, secret.privateKeyCompressed)
    setKey(Number(keyIndex))

    try {
      const account = getAccountData()
      const data = await accountBuilderFinish(account)
      if (!data?.wallet) {
        toast.error(t('account.import.wif.invalid'))
        return
      }
      router.navigate(
        `/signer/bitcoin/account/add/created/${data.accountWithEncryptedSecret.id}`
      )
      setTimeout(clearAccount, 1500)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown'
      toast.error(`${t('account.import.wif.invalid')}: ${reason}`)
    }
  }

  function handleCancel() {
    clearKeyState()
    router.back()
  }

  const wifError = wifFieldError(wif, decoded)

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{name}</SSText>
        }}
      />
      <ScrollView>
        <SSVStack gap="lg">
          <SSFormLayout>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('account.import.wif.title')} />
              <SSTextInput
                value={wif}
                onChangeText={handleWifChange}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                status={wifError ? 'invalid' : undefined}
                error={wifError}
              />
            </SSFormLayout.Item>
            <SSFormLayout.Item>
              <SSFormLayout.Label label={t('account.script')} />
              <SSButton
                label={`${t(
                  `script.${importScript.toLowerCase()}.name`
                )} (${importScript})`}
                withSelect
                onPress={() => setScriptVersionModalVisible(true)}
              />
            </SSFormLayout.Item>
          </SSFormLayout>
          {decoded.ok ? (
            <SSText color="muted" center>
              {t('account.import.wif.singleAddress')}
            </SSText>
          ) : null}
          {decoded.ok && !decoded.compressed ? (
            <SSText color="muted" center>
              {t('account.import.wif.script.uncompressed')}
            </SSText>
          ) : null}
          <SSVStack gap="sm">
            <SSButton
              label={t('account.import.wif.title')}
              variant="secondary"
              loading={loading}
              disabled={!decoded.ok}
              onPress={handleImport}
            />
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={handleCancel}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
      <SSScriptVersionModal
        visible={scriptVersionModalVisible}
        scriptVersion={importScript}
        disabledScripts={limits.map((limit) => ({
          reason: wifScriptReason(limit.reason),
          script: limit.script
        }))}
        onSelect={handleSelectScript}
        onCancel={() => setScriptVersionModalVisible(false)}
      />
    </SSMainLayout>
  )
}
