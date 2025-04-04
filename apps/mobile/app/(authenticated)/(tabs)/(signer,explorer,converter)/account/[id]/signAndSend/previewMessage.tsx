import { type Network } from 'bdk-rn/lib/lib/enums'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { buildTransaction } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSGradientModal from '@/components/SSGradientModal'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { useWalletsStore } from '@/store/wallets'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress, formatNumber } from '@/utils/format'
import { getUtxoOutpoint } from '@/utils/utxo'

export default function PreviewMessage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [inputs, outputs, feeRate, rbf, setTxBuilderResult] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.inputs,
        state.outputs,
        state.feeRate,
        state.rbf,
        state.setTxBuilderResult
      ])
    )
  const account = useAccountsStore((state) =>
    state.accounts.find((account) => account.id === id)
  )
  const wallet = useWalletsStore((state) => state.wallets[id!])
  const network = useBlockchainStore((state) => state.network)
  const [messageId, setMessageId] = useState('')

  const [noKeyModalVisible, setNoKeyModalVisible] = useState(false)

  useEffect(() => {
    async function getTransactionMessage() {
      if (!wallet) return

      try {
        const transactionMessage = await buildTransaction(
          wallet,
          {
            inputs: Array.from(inputs.values()),
            outputs: Array.from(outputs.values()),
            feeRate,
            options: {
              rbf
            }
          },
          network as Network
        )

        setMessageId(transactionMessage.txDetails.txid)
        setTxBuilderResult(transactionMessage)
      } catch (err) {
        toast.error(String(err))
      }
    }

    getTransactionMessage()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!account) return <Redirect href="/" />

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
                {t('transaction.id')}
              </SSText>
              <SSText size="lg">
                {messageId || `${t('common.loading')}...`}
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
            disabled={!messageId}
            label={t('sign.transaction')}
            onPress={() =>
              router.navigate(`/account/${id}/signAndSend/signMessage`)
            }
          />
        </SSVStack>
        <SSGradientModal
          visible={noKeyModalVisible}
          closeText={t('common.cancel')}
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
