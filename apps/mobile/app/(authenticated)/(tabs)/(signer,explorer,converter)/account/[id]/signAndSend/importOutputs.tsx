import * as Clipboard from 'expo-clipboard'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, View } from 'react-native'

import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { tn } from '@/locales'
import { Colors } from '@/styles'

const t = tn('transaction.build.options.importOutputs')
const t_common = tn('common')

function ImportOuputs() {
  const router = useRouter()
  const [importedOutputs, setImportedOutputs] = useState(t('emptyContent'))
  const [validInput, setValidInput] = useState(false)

  async function readFromClibpoard() {
    const text = await Clipboard.getStringAsync()
    if (text) setImportedOutputs(text)
    setValidInput(true)
  }

  function importOutputs() {
    router.back()
  }

  function cancel() {
    router.back()
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>EXTRA SECURITY</SSText>
        }}
      />
      <SSMainLayout style={{ paddingTop: 12, paddingBottom: 24 }}>
        <SSVStack justifyBetween>
          <SSVStack>
            <SSText uppercase center size="lg">
              {t('title')}
            </SSText>
            <ScrollView>
              <View
                style={{
                  padding: 10,
                  backgroundColor: Colors.gray[900],
                  borderRadius: 5,
                  minHeight: 400
                }}
              >
                <SSText color="white" size="md" type="mono">
                  {importedOutputs}
                </SSText>
              </View>
            </ScrollView>
          </SSVStack>
          <SSVStack>
            <SSHStack>
              <SSButton
                label="PASTE"
                style={{ width: '45%', flexGrow: 1 }}
                onPress={readFromClibpoard}
              />
              <SSButton
                label="SCAN QRCODE"
                style={{ width: '45%', flexGrow: 1 }}
                disabled
              />
            </SSHStack>
            <SSButton
              uppercase
              label={t('button')}
              variant="secondary"
              onPress={importOutputs}
              disabled={!validInput}
            />
            <SSButton
              uppercase
              label={t_common('cancel')}
              variant="ghost"
              onPress={cancel}
            />
          </SSVStack>
        </SSVStack>
      </SSMainLayout>
    </>
  )
}

export default ImportOuputs
