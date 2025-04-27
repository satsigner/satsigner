import { type Network } from 'bdk-rn/lib/lib/enums'
import * as bitcoinjs from 'bitcoinjs-lib'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'
import * as Clipboard from 'expo-clipboard'

import { buildTransaction } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSGradientModal from '@/components/SSGradientModal'
import SSText from '@/components/SSText'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { useWalletsStore } from '@/store/wallets'
import { type Output } from '@/types/models/Output'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { parseHexToBytes } from '@/utils/parse'
import { estimateTransactionSize } from '@/utils/transaction'
import SSQRCode from '@/components/SSQRCode'
import SSHStack from '@/layouts/SSHStack'
import SSTextInput from '@/components/SSTextInput'
import { Colors } from '@/styles'

const tn = _tn('transaction.build.preview')

function PreviewMessage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [inputs, outputs, feeRate, rbf, setTxBuilderResult, txBuilderResult] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.inputs,
        state.outputs,
        state.feeRate,
        state.rbf,
        state.setTxBuilderResult,
        state.txBuilderResult
      ])
    )
  const account = useAccountsStore((state) =>
    state.accounts.find((account) => account.id === id)
  )
  const wallet = useWalletsStore((state) => state.wallets[id!])
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const [messageId, setMessageId] = useState('')

  const [noKeyModalVisible, setNoKeyModalVisible] = useState(false)
  const [psbtString, setPsbtString] = useState('')

  const transactionHex = useMemo(() => {
    if (!account) return ''

    const transaction = new bitcoinjs.Transaction()
    const network = bitcoinjsNetwork(account.network)

    for (const input of inputs.values()) {
      const hashBuffer = Buffer.from(parseHexToBytes(input.txid))
      transaction.addInput(hashBuffer, input.vout)
    }

    for (const output of outputs) {
      const outputScript = bitcoinjs.address.toOutputScript(output.to, network)
      transaction.addOutput(outputScript, output.amount)
    }

    return transaction.toHex()
  }, [account, inputs, outputs])

  const transaction = useMemo(() => {
    const { size, vsize } = estimateTransactionSize(
      inputs.size,
      outputs.length + 1
    )

    const vin = [...inputs.values()].map((input: Utxo) => ({
      previousOutput: {
        txid: input.txid,
        vout: input.vout
      },
      value: input.value,
      label: input.label || ''
    }))

    const vout = outputs.map((output: Output) => ({
      address: output.to,
      value: output.amount,
      label: output.label || ''
    }))

    const totalVin = vin.reduce((previousValue, input) => {
      return previousValue + input.value
    }, 0)
    const totalVout = vout.reduce((previousValue, output) => {
      return previousValue + output.value
    }, 0)
    const minerFee = feeRate * vsize
    const changeValue = totalVin - totalVout - minerFee

    if (changeValue !== 0) {
      vout.push({
        address: t('transaction.build.change'),
        value: changeValue,
        label: ''
      })
    }

    return {
      id: messageId,
      size,
      vsize,
      vin,
      vout
    } as never as Transaction
  }, [inputs, outputs, messageId, feeRate])

  useEffect(() => {
    async function getTransactionMessage() {
      if (!wallet) {
        toast.error(t('error.notFound.wallet'))
        return
      }

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

  useEffect(() => {
    async function getPsbtString() {
      if (txBuilderResult?.psbt) {
        const serialized = await txBuilderResult.psbt.serialize()
        setPsbtString(serialized)
      }
    }
    getPsbtString()
  }, [txBuilderResult])

  if (!id || !account) return <Redirect href="/" />

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
        }}
      />
      <SSMainLayout style={styles.mainLayout}>
        <SSVStack justifyBetween>
          <ScrollView>
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
                  {tn('contents')}
                </SSText>
                <SSTransactionChart transaction={transaction} />
              </SSVStack>
              <SSVStack gap="xxs">
                <SSText
                  uppercase
                  size="sm"
                  color="muted"
                  style={{ marginBottom: -22 }}
                >
                  {tn('decoded')}
                </SSText>
                {transactionHex !== '' && (
                  <SSTransactionDecoded txHex={transactionHex} />
                )}
              </SSVStack>
              {account.policyType !== 'watchonly' ? (
                <SSButton
                  variant="secondary"
                  disabled={!messageId}
                  label={t('sign.transaction')}
                  onPress={() =>
                    router.navigate(`/account/${id}/signAndSend/signMessage`)
                  }
                />
              ) : (
                (account.keys[0].creationType === 'importDescriptor' ||
                  account.keys[0].creationType === 'importExtendedPub') && (
                  <>
                    <SSText
                      center
                      color="muted"
                      size="sm"
                      uppercase
                      style={{ marginTop: 16 }}
                    >
                      {t('sign.exportUnsigned')}
                    </SSText>
                    <SSHStack gap="xxs" justifyBetween>
                      <SSButton
                        variant="outline"
                        disabled={!messageId}
                        label={t('common.copy')}
                        style={{ width: '48%' }}
                        onPress={() => {
                          if (transactionHex) {
                            Clipboard.setStringAsync(transactionHex)
                            toast(t('common.copied'))
                          }
                        }}
                      />
                      <SSButton
                        variant="outline"
                        disabled={!messageId}
                        label={t('common.QR')}
                        style={{ width: '48%' }}
                        onPress={() => {
                          setNoKeyModalVisible(true)
                        }}
                      />
                    </SSHStack>
                    <SSHStack gap="xxs" justifyBetween>
                      <SSButton
                        label="NFC"
                        style={{ width: '48%' }}
                        variant="outline"
                        disabled
                      />
                      <SSButton
                        label="USB"
                        style={{ width: '48%' }}
                        variant="outline"
                        disabled
                      />
                    </SSHStack>
                    <SSText
                      center
                      color="muted"
                      size="sm"
                      uppercase
                      style={{ marginTop: 16 }}
                    >
                      {t('sign.importSigned')}
                    </SSText>
                    <SSTextInput
                      placeholder={t('sign.signedPsbt')}
                      editable={false}
                      style={{ marginVertical: 8 }}
                    />
                    <SSHStack gap="xxs" justifyBetween>
                      <SSButton
                        label="Paste"
                        style={{ width: '48%' }}
                        variant="outline"
                      />
                      <SSButton
                        label="Scan QR"
                        style={{ width: '48%' }}
                        variant="outline"
                      />
                    </SSHStack>
                    <SSHStack gap="xxs" justifyBetween>
                      <SSButton
                        label="USB"
                        style={{ width: '48%' }}
                        variant="outline"
                        disabled
                      />
                      <SSButton
                        label="NFC"
                        style={{ width: '48%' }}
                        variant="outline"
                        disabled
                      />
                    </SSHStack>
                  </>
                )
              )}
            </SSVStack>
          </ScrollView>
        </SSVStack>
        <SSGradientModal
          visible={noKeyModalVisible}
          closeText={t('common.cancel')}
          onClose={() => setNoKeyModalVisible(false)}
        >
          <SSVStack style={{ marginTop: 16 }} itemsCenter>
            <SSText color="muted" size="lg" uppercase>
              {tn('psbt')}
            </SSText>
            {psbtString && (
              <View
                style={{
                  padding: 10,
                  backgroundColor: Colors.white,
                  width: '100%'
                }}
              >
                <SSQRCode
                  value={psbtString}
                  color={Colors.black}
                  backgroundColor={Colors.white}
                />
              </View>
            )}
          </SSVStack>
        </SSGradientModal>
      </SSMainLayout>
    </>
  )
}

const styles = StyleSheet.create({
  mainLayout: {
    paddingTop: 0,
    paddingBottom: 20
  },
  modalStack: {
    marginVertical: 32,
    width: '100%',
    paddingHorizontal: 32
  }
})

export default PreviewMessage
