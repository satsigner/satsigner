import { Image } from 'expo-image'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSCollapsible from '@/components/SSCollapsible'
import SSLink from '@/components/SSLink'
import SSRadioButton from '@/components/SSRadioButton'
import SSSelectModal from '@/components/SSSelectModal'
import SSText from '@/components/SSText'
import SSFormLayout from '@/layouts/SSFormLayout'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { type Account } from '@/types/models/Account'
import { setStateWithLayoutAnimation } from '@/utils/animation'

export default function AccountOptions() {
  const router = useRouter()
  const [name, type, setScriptVersion, setSeedWordCount, generateMnemonic] =
    useAccountBuilderStore(
      useShallow((state) => [
        state.name,
        state.type,
        state.setScriptVersion,
        state.setSeedWordCount,
        state.generateMnemonic
      ])
    )

  const [localScriptVersion, setLocalScriptVersion] =
    useState<NonNullable<Account['scriptVersion']>>('P2WPKH')
  const [localSeedWordCount, setLocalSeedWordCount] =
    useState<NonNullable<Account['seedWordCount']>>(24)

  const [scriptVersionModalVisible, setScriptVersionModalVisible] =
    useState(false)
  const [seedWordCountModalVisible, setSeedWordCountModalVisibile] =
    useState(false)

  const [loading, setLoading] = useState(false)

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

  function getSeedWordCountButtonLabel() {
    if (localSeedWordCount === 12)
      return `12 ${i18n.t('bitcoin.words').toLowerCase()}`
    if (localSeedWordCount === 15)
      return `15 ${i18n.t('bitcoin.words').toLowerCase()}`
    if (localSeedWordCount === 18)
      return `18 ${i18n.t('bitcoin.words').toLowerCase()}`
    if (localSeedWordCount === 21)
      return `21 ${i18n.t('bitcoin.words').toLowerCase()}`
    if (localSeedWordCount === 24)
      return `24 ${i18n.t('bitcoin.words').toLowerCase()}`

    return ''
  }

  function getContinueButtonLabel() {
    if (type === 'generate')
      return i18n.t('addMasterKey.accountOptions.generateNewSeed')
    else if (type === 'import')
      return i18n.t('addMasterKey.accountOptions.importSeed')

    return ''
  }

  async function handleOnPressConfirmAccountOptions() {
    setScriptVersion(localScriptVersion)
    setSeedWordCount(localSeedWordCount)

    if (type === 'generate') {
      setLoading(true)
      await generateMnemonic(localSeedWordCount)
      setLoading(false)
      router.navigate('/addMasterKey/generateSeed')
    } else if (type === 'import') router.navigate('/addMasterKey/importSeed')
  }

  function handleOnSelectScriptVersion() {
    setLocalScriptVersion(localScriptVersion)
    setScriptVersionModalVisible(false)
  }

  function handleOnSelectSeedWordCount() {
    setLocalSeedWordCount(localSeedWordCount)
    setSeedWordCountModalVisibile(false)
  }

  return (
    <SSMainLayout>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{name}</SSText>
        }}
      />
      <SSVStack justifyBetween>
        <SSFormLayout>
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
          <SSFormLayout.Item>
            <SSFormLayout.Label
              label={i18n.t('addMasterKey.accountOptions.mnemonic')}
            />
            <SSButton
              label={getSeedWordCountButtonLabel()}
              withSelect
              onPress={() => setSeedWordCountModalVisibile(true)}
            />
          </SSFormLayout.Item>
        </SSFormLayout>
        <SSVStack>
          <SSButton
            label={getContinueButtonLabel()}
            variant="secondary"
            loading={loading}
            onPress={() => handleOnPressConfirmAccountOptions()}
          />
          <SSButton
            label={i18n.t('common.cancel')}
            variant="ghost"
            onPress={() => router.navigate('/')}
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
            <Image
              source={require('@/assets/icons/scripts/p2pkh.svg')}
              style={{ width: '100%', height: 80 }}
            />
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
      <SSSelectModal
        visible={seedWordCountModalVisible}
        title={i18n.t('addMasterKey.accountOptions.mnemonic')}
        selectedText={`${localSeedWordCount} ${i18n.t('bitcoin.words')}`}
        selectedDescription={i18n.t(
          `addMasterKey.accountOptions.mnemonics.${localSeedWordCount}`
        )}
        onSelect={() => handleOnSelectSeedWordCount()}
        onCancel={() => setSeedWordCountModalVisibile(false)}
      >
        <SSRadioButton
          label={`24 ${i18n.t('bitcoin.words').toLowerCase()}`}
          selected={localSeedWordCount === 24}
          onPress={() => setStateWithLayoutAnimation(setLocalSeedWordCount, 24)}
        />
        <SSRadioButton
          label={`21 ${i18n.t('bitcoin.words').toLowerCase()}`}
          selected={localSeedWordCount === 21}
          onPress={() => setStateWithLayoutAnimation(setLocalSeedWordCount, 21)}
        />
        <SSRadioButton
          label={`18 ${i18n.t('bitcoin.words').toLowerCase()}`}
          selected={localSeedWordCount === 18}
          onPress={() => setStateWithLayoutAnimation(setLocalSeedWordCount, 18)}
        />
        <SSRadioButton
          label={`15 ${i18n.t('bitcoin.words').toLowerCase()}`}
          selected={localSeedWordCount === 15}
          onPress={() => setStateWithLayoutAnimation(setLocalSeedWordCount, 15)}
        />
        <SSRadioButton
          label={`12 ${i18n.t('bitcoin.words').toLowerCase()}`}
          selected={localSeedWordCount === 12}
          onPress={() => setStateWithLayoutAnimation(setLocalSeedWordCount, 12)}
        />
      </SSSelectModal>
    </SSMainLayout>
  )
}