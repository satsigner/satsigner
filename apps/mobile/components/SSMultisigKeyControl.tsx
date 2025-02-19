import { useRouter } from 'expo-router'
import { useShallow } from 'zustand/react/shallow'

import { SSIconAdd, SSIconClose } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSIconButton from '@/components/SSIconButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountBuilderStore } from '@/store/accountBuilder'

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

  const [seedWordCount, generateMnemonic, setCurrentParticipantIndex] =
    useAccountBuilderStore(
      useShallow((state) => [
        state.seedWordCount,
        state.generateMnemonic,
        state.setCurrentParticipantIndex
      ])
    )
  async function handleOnClickGenerate() {
    setCurrentParticipantIndex(index - 1)
    await generateMnemonic(seedWordCount)
    router.navigate('/addMasterKey/generateSeed')
  }

  function handleOnClickImport() {
    setCurrentParticipantIndex(index - 1)
    router.navigate('/addMasterKey/importSeed')
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
      <SSHStack justifyBetween style={{ alignItems: 'flex-start' }}>
        <SSHStack style={{ alignItems: 'flex-start' }}>
          <SSIconButton
            onPress={() => {
              collapseChanged(!collapsed)
            }}
          >
            {collapsed ? (
              <SSIconClose width={24} height={24} />
            ) : (
              <SSIconAdd width={24} height={24} />
            )}
          </SSIconButton>
          <SSVStack gap="none">
            <SSText>Key {index}</SSText>
            <SSText>Select key source</SSText>
            <SSText>Memo: empty</SSText>
          </SSVStack>
        </SSHStack>
        <SSVStack gap="none" style={{ alignItems: 'flex-end' }}>
          <SSText>Empty</SSText>
          <SSText>Aug 20, 2020</SSText>
        </SSVStack>
      </SSHStack>
      {collapsed && (
        <>
          <SSButton
            label={t('account.generate.title')}
            onPress={handleOnClickGenerate}
          />
          <SSButton
            label={t('account.import.title')}
            onPress={handleOnClickImport}
          />
        </>
      )}
    </SSVStack>
  )
}
