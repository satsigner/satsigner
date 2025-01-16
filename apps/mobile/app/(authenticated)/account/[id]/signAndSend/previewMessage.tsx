import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import SSButton from '@/components/SSButton'
import SSGradientModal from '@/components/SSGradientModal'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import type { AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress, formatNumber } from '@/utils/format'
import { getUtxoOutpoint } from '@/utils/utxo'

export default function PreviewMessage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const getCurrentAccount = useAccountsStore((state) => state.getCurrentAccount)
  const [inputs, outputs] = useTransactionBuilderStore(
    useShallow((state) => [state.inputs, state.outputs])
  )

  const account = getCurrentAccount(id!)!

  const [noKeyModalVisible, setNoKeyModalVisible] = useState(true)

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
        }}
      />
      <SSMainLayout>
        <SSVStack justifyBetween>
          <SSVStack>
            <SSVStack gap="xxs">
              <SSText color="muted" size="sm" uppercase>
                Message Id
              </SSText>
              <SSText size="lg">
                e3b71e8056ceb986ad0172205bef03d6b4d091bdc7bfc3cc25fbb1d18608e485
              </SSText>
            </SSVStack>
            <SSVStack gap="xxs">
              <SSText color="muted" size="sm" uppercase>
                Contents
              </SSText>
              <SSHStack>
                <SSVStack>
                  <SSText>Inputs:</SSText>
                  {[...inputs.values()].map((utxo) => (
                    <SSVStack gap="none" key={getUtxoOutpoint(utxo)}>
                      <SSText>{formatNumber(utxo.value)} sats</SSText>
                      <SSHStack gap="xs">
                        <SSText color="muted" size="xs">
                          from
                        </SSText>
                        <SSText size="xs">
                          {formatAddress(utxo.addressTo || '')}
                        </SSText>
                      </SSHStack>
                    </SSVStack>
                  ))}
                </SSVStack>
                <SSVStack gap="none">
                  <SSText color="muted">Bytes:</SSText>
                  <SSText>...</SSText>
                </SSVStack>
                <SSVStack>
                  <SSText>Outputs:</SSText>
                  {[...outputs].map((output) => (
                    <SSVStack gap="none" key={output.localId}>
                      <SSText>{formatNumber(output.amount)} sats</SSText>
                      <SSHStack gap="xs">
                        <SSText color="muted" size="xs">
                          from
                        </SSText>
                        <SSText size="xs">{formatAddress(output.to)}</SSText>
                      </SSHStack>
                      <SSText color="muted" size="xxs">
                        "{output.label}"
                      </SSText>
                    </SSVStack>
                  ))}
                </SSVStack>
              </SSHStack>
            </SSVStack>
            <SSVStack gap="xxs">
              <SSText color="muted" size="sm" uppercase>
                Full Message
              </SSText>
            </SSVStack>
          </SSVStack>
          <SSButton
            variant="secondary"
            label={i18n.t('previewMessage.signTxMessage')}
            onPress={() =>
              router.navigate(`/account/${id}/signAndSend/signMessage`)
            }
          />
        </SSVStack>
        <SSGradientModal
          visible={noKeyModalVisible}
          closeText={i18n.t('common.cancel')}
          onClose={() => setNoKeyModalVisible(false)}
        >
          <SSVStack style={{ marginTop: 16 }}>
            <SSText color="muted" size="lg" uppercase>
              Missing Private Key
            </SSText>
          </SSVStack>
          <SSVStack
            itemsCenter
            style={{ marginVertical: 32, width: '100%', paddingHorizontal: 32 }}
          >
            <SSText center>
              Input your secret private key to sign the transaction
            </SSText>
            <SSButton label="Seed" />
            <SSButton label="WIF" />
            <SSButton label="NFC Card" />
          </SSVStack>
          <SSVStack
            itemsCenter
            style={{ marginVertical: 32, width: '100%', paddingHorizontal: 32 }}
          >
            <SSText center>
              PSBT: Share partially signed bitcoin transaction on external
              hardware
            </SSText>
            <SSButton label="QR Code" />
            <SSButton label="NFC" />
            <SSButton label="Share" />
          </SSVStack>
        </SSGradientModal>
      </SSMainLayout>
    </>
  )
}
