import { useState } from 'react'

import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { Colors } from '@/styles'
import { type Key } from '@/types/models/Account'
import { setStateWithLayoutAnimation } from '@/utils/animation'
import { getScriptVersionDisplayName } from '@/utils/scripts'

import SSCollapsible from './SSCollapsible'
import SSRadioButton from './SSRadioButton'
import SSScriptDiagram from './SSScriptDiagram'
import SSSelectModal from './SSSelectModal'
import SSText from './SSText'

type ScriptVersion = NonNullable<Key['scriptVersion']>

const singleSigScriptVersions: ScriptVersion[] = [
  'P2PKH',
  'P2SH-P2WPKH',
  'P2WPKH',
  'P2TR'
]

const multiSigScriptVersions: ScriptVersion[] = ['P2SH', 'P2SH-P2WSH', 'P2WSH']

type DisabledScript = {
  script: ScriptVersion
  reason: string
}

const NO_DISABLED_SCRIPTS: DisabledScript[] = []

type SSScriptVersionModalProps = {
  visible: boolean
  scriptVersion: ScriptVersion
  policyType?: 'singlesig' | 'multisig' | 'watchonly'
  disabledScripts?: DisabledScript[]
  onSelect: (scriptVersion: ScriptVersion) => void
  onCancel: () => void
}

function SSScriptVersionModal({
  visible,
  scriptVersion,
  policyType = 'singlesig',
  disabledScripts = NO_DISABLED_SCRIPTS,
  onSelect,
  onCancel
}: SSScriptVersionModalProps) {
  const [localScriptVersion, setLocalScriptVersion] = useState(scriptVersion)

  const scriptVersions =
    policyType === 'multisig' ? multiSigScriptVersions : singleSigScriptVersions

  function handleOnSelectScriptVersion() {
    setLocalScriptVersion(localScriptVersion)
    onSelect(localScriptVersion)
  }

  return (
    <SSSelectModal
      visible={visible}
      title={t('account.script')}
      selectedText={`${localScriptVersion} - ${t(
        `script.${localScriptVersion.toLowerCase()}.name`
      )}`}
      selectedDescription={
        <SSCollapsible fadeColor={Colors.black}>
          <SSVStack gap="md">
            <SSText color="muted" size="md">
              {t(`script.${localScriptVersion.toLowerCase()}.description`)}
            </SSText>
            <SSScriptDiagram scriptVersion={localScriptVersion} />
          </SSVStack>
        </SSCollapsible>
      }
      onSelect={() => handleOnSelectScriptVersion()}
      onCancel={onCancel}
    >
      {scriptVersions.map((script) => {
        const disabled = disabledScripts.find((item) => item.script === script)
        return (
          <SSVStack key={script} gap="xs">
            <SSRadioButton
              label={getScriptVersionDisplayName(script)}
              selected={localScriptVersion === script}
              disabled={Boolean(disabled)}
              onPress={() =>
                setStateWithLayoutAnimation(setLocalScriptVersion, script)
              }
            />
            {disabled ? (
              <SSText color="muted" size="sm">
                {disabled.reason}
              </SSText>
            ) : null}
          </SSVStack>
        )
      })}
    </SSSelectModal>
  )
}

export default SSScriptVersionModal
