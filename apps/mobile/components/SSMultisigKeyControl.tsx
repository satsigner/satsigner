import { useRouter } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'

import { SSIconAdd, SSIconGreen } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'
import { formatAddress } from '@/utils/format'

export type SSMultisigKeyControlProps = {
  isBlackBackground: boolean
  collapsed: boolean
  collapseChanged: (value: boolean) => void
  index: number
}

export default function SSMultisigKeyControl({
  isBlackBackground,
  collapsed,
  collapseChanged,
  index
}: SSMultisigKeyControlProps) {
  const router = useRouter()

  const [participants] = useAccountBuilderStore(
    useShallow((state) => [state.participants])
  )

  const participant = participants![index - 1]

  const [setCurrentParticipantIndex, setParticipantCreationType] =
    useAccountBuilderStore(
      useShallow((state) => [
        state.setCurrentParticipantIndex,
        state.setParticipantCreationType
      ])
    )

  async function handleOnClickGenerate() {
    setCurrentParticipantIndex(index - 1)
    setParticipantCreationType('generate')
    router.navigate('/addMasterKey/participantOptions')
  }

  function handleOnClickImport() {
    setCurrentParticipantIndex(index - 1)
    setParticipantCreationType('importseed')
    router.navigate('/addMasterKey/participantOptions')
  }

  function handleOnClickImportDescriptor() {
    setCurrentParticipantIndex(index - 1)
    setParticipantCreationType('importdescriptor')
    router.navigate('/addMasterKey/importDescriptor')
  }

  function getSourceLabel() {
    if (participant === undefined || participant === null) {
      return t('account.selectKeySource')
    } else if (participant.creationType === 'generate') {
      return t('account.seed.newSeed', { name: participant.scriptVersion })
    } else if (participant.creationType === 'importseed') {
      return t('account.seed.importedSeed', { name: participant.scriptVersion })
    } else if (participant.creationType === 'importdescriptor') {
      return t('account.seed.external')
    }
  }

  return (
    <SSVStack
      style={{
        borderColor: '#6A6A6A',
        borderTopWidth: 2,
        borderBottomWidth: 2,
        backgroundColor: isBlackBackground ? 'black' : '#1E1E1E',
        paddingHorizontal: 16,
        paddingBottom: 32,
        paddingTop: 16
      }}
    >
      <SSHStack justifyBetween>
        <SSHStack style={{ alignItems: 'center' }}>
          <SSIconButton
            onPress={() => {
              collapseChanged(!collapsed)
            }}
          >
            {participant ? (
              <SSIconGreen width={24} height={24} />
            ) : (
              <SSIconAdd width={24} height={24} />
            )}
          </SSIconButton>
          <SSText>Key {index}</SSText>
          <SSVStack gap="none">
            <SSText>{getSourceLabel()}</SSText>
            <SSText>{participant?.keyName ?? t('account.seed.noLabel')}</SSText>
          </SSVStack>
        </SSHStack>
        <SSVStack gap="none" style={{ alignItems: 'flex-end' }}>
          <SSText>
            {participant?.fingerprint ?? t('account.fingerprint')}
          </SSText>
          <SSText>
            {participant?.publicKey
              ? formatAddress(participant?.publicKey, 6)
              : t('account.seed.publicKey')}
          </SSText>
        </SSVStack>
      </SSHStack>
      {collapsed &&
        (participant ? (
          <>
            <SSButton
              uppercase
              label={t('account.seed.dropAndKeep')}
              variant="outline"
            />
            <SSButton uppercase label={t('account.seed.sharePub')} />
            <SSButton uppercase label={t('account.seed.shareDescriptor')} />
          </>
        ) : (
          <>
            <SSButton
              label={t('account.generate.title')}
              onPress={handleOnClickGenerate}
            />
            <SSButton
              label={t('account.import.title')}
              onPress={handleOnClickImport}
            />
            <SSButton
              label={t('account.import.descriptor')}
              onPress={handleOnClickImportDescriptor}
            />
          </>
        ))}
    </SSVStack>
  )
}
