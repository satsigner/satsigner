import { i18n } from '@/locales'
import { setStateWithLayoutAnimation } from '@/utils/animation'
import SSCollapsible from '@/components/SSCollapsible'
import SSLink from '@/components/SSLink'
import { SSIconScriptsP2pkh } from '@/components/icons'
import SSRadioButton from '@/components/SSRadioButton'
import SSButton from '@/components/SSButton'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { useAccountsStore } from '@/store/accounts'
import { Colors } from '@/styles'
import { Account } from '@/types/models/Account'
import { AccountSearchParams } from '@/types/navigation/searchParams'
import { Redirect, Stack, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'
import SSFormLayout from '@/layouts/SSFormLayout'

export default function AccountSettings() {
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [account] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((account) => account.name === id)
    ])
  )

  if (!account) return <Redirect href="/" />

  const [localScriptVersion, setLocalScriptVersion] =
    useState<NonNullable<Account['scriptVersion']>>('P2WPKH')

  const [scriptVersionModalVisible, setScriptVersionModalVisible] =
    useState(false)

  function getScriptVersionButtonLabel() {
    if (localScriptVersion === 'P2PKH')
      return `${i18n.t('addMasterKey.accountOptions.scriptVersions.names.p2pkh')} (P2PKH)`
    else if (localScriptVersion === 'P2SH-P2WPKH')
      return `${i18n.t('addMasterKey.accountOptions.scriptVersions.names.p2sh-p2wpkh')} (P2SH-P2WPKH)`
    else if (localScriptVersion === 'P2WPKH')
      return `${i18n.t('addMasterKey.accountOptions.scriptVersions.names.p2wpkh')} (P2WPKH)`
    else if (localScriptVersion === 'P2TR')
      return `${i18n.t('addMasterKey.accountOptions.scriptVersions.names.p2tr')} (P2TR)`

    return ''
  }

  function handleOnSelectScriptVersion() {
    setLocalScriptVersion(localScriptVersion)
    setScriptVersionModalVisible(false)
  }

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{id}</SSText>
        }}
      />
      <SSVStack gap="lg" style={{ padding: 20 }}>
        <SSText center uppercase color="muted">
          Master Key Settings and Tools
        </SSText>
        <SSVStack itemsCenter gap="none">
          <SSHStack gap="sm">
            <SSText color="muted">Fingerprint</SSText>
            <SSText style={{ color: Colors.success }}>23af61ff</SSText>
          </SSHStack>
          <SSHStack gap="sm">
            <SSText color="muted">Created on</SSText>
            <SSText>Jan 3, 20257 03:09:00 UTC</SSText>
          </SSHStack>
        </SSVStack>
        <SSVStack>
          <SSHStack>
            <SSButton style={{ flex: 1 }} label="VIEW SEED" />
          </SSHStack>
          <SSHStack>
            <SSButton
              style={{ flex: 1 }}
              label="EXPORT LABELS"
              variant="gradient"
            />
            <SSButton
              style={{ flex: 1 }}
              label="IMPORT LABELS"
              variant="gradient"
            />
          </SSHStack>
          <SSHStack>
            <SSButton
              style={{ flex: 1 }}
              label="REPLACE KEY"
              variant="gradient"
            />
            <SSButton
              style={{ flex: 1 }}
              label="EXPORT CONFIG"
              variant="gradient"
            />
          </SSHStack>
        </SSVStack>
        <SSFormLayout>
          <SSFormLayout.Item>
            <SSFormLayout.Label
              label="Account Name"
            />
            <SSTextInput />
          </SSFormLayout.Item>
        <SSFormLayout.Item>
            <SSFormLayout.Label
              label="Network"
            />
            <SSButton
              label="Signet"
              withSelect
            />
          </SSFormLayout.Item>
        <SSFormLayout.Item>
            <SSFormLayout.Label
              label={i18n.t('addMasterKey.accountOptions.policyType')}
            />
            <SSButton
              label={i18n.t(
                'addMasterKey.accountOptions.policyTypes.singleSignature'
              )}
              withSelect
            />
          </SSFormLayout.Item>
          <SSFormLayout.Item>
            <SSFormLayout.Label
              label={i18n.t('addMasterKey.accountOptions.scriptVersion')}
            />
            <SSButton
              label={getScriptVersionButtonLabel()}
              withSelect
              onPress={() => setScriptVersionModalVisible(true)}
            />
          </SSFormLayout.Item>
        </SSFormLayout>
        <SSVStack style={{ marginTop: 60 }}>
          <SSButton
            label="DUPLICATE MASTER KEY"
          />
          <SSButton
            label="DELETE MASTER KEY"
            style={{
              backgroundColor: Colors.error
            }}
          />
          <SSButton
            label="SAVE"
            variant="secondary"
          />
        </SSVStack>
      </SSVStack>
      <SSSelectModal
        visible={scriptVersionModalVisible}
        title={i18n.t('addMasterKey.accountOptions.scriptVersion')}
        selectedText={`${localScriptVersion} - ${i18n.t(
          `addMasterKey.accountOptions.scriptVersions.names.${localScriptVersion?.toLowerCase()}`
        )}`}
        selectedDescription={
          <SSCollapsible>
            <SSText color="muted" size="md">
              {i18n.t(
                `addMasterKey.accountOptions.scriptVersions.descriptions.${localScriptVersion?.toLowerCase()}.0`
              )}
              <SSLink
                size="md"
                text={i18n.t(
                  `addMasterKey.accountOptions.scriptVersions.links.name.${localScriptVersion?.toLowerCase()}`
                )}
                url={i18n.t(
                  `addMasterKey.accountOptions.scriptVersions.links.url.${localScriptVersion?.toLowerCase()}`
                )}
              />
              {i18n.t(
                `addMasterKey.accountOptions.scriptVersions.descriptions.${localScriptVersion?.toLowerCase()}.1`
              )}
            </SSText>
            <SSIconScriptsP2pkh height={80} width="100%" />
          </SSCollapsible>
        }
        onSelect={() => handleOnSelectScriptVersion()}
        onCancel={() => setScriptVersionModalVisible(false)}
      >
        <SSRadioButton
          label={`${i18n.t(
            'addMasterKey.accountOptions.scriptVersions.names.p2pkh'
          )} (P2PKH)`}
          selected={localScriptVersion === 'P2PKH'}
          onPress={() =>
            setStateWithLayoutAnimation(setLocalScriptVersion, 'P2PKH')
          }
        />
        <SSRadioButton
          label={`${i18n.t(
            'addMasterKey.accountOptions.scriptVersions.names.p2sh-p2wpkh'
          )} (P2SH-P2WPKH)`}
          selected={localScriptVersion === 'P2SH-P2WPKH'}
          onPress={() =>
            setStateWithLayoutAnimation(setLocalScriptVersion, 'P2SH-P2WPKH')
          }
        />
        <SSRadioButton
          label={`${i18n.t(
            'addMasterKey.accountOptions.scriptVersions.names.p2wpkh'
          )} (P2WPKH)`}
          selected={localScriptVersion === 'P2WPKH'}
          onPress={() =>
            setStateWithLayoutAnimation(setLocalScriptVersion, 'P2WPKH')
          }
        />
        <SSRadioButton
          label={`${i18n.t(
            'addMasterKey.accountOptions.scriptVersions.names.p2tr'
          )} (P2TR)`}
          selected={localScriptVersion === 'P2TR'}
          onPress={() =>
            setStateWithLayoutAnimation(setLocalScriptVersion, 'P2TR')
          }
        />
      </SSSelectModal>
    </ScrollView>
  )
}
