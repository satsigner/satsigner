import { type Network } from 'bdk-rn/lib/lib/enums'
import * as bitcoinjs from 'bitcoinjs-lib'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { buildTransaction } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSGradientModal from '@/components/SSGradientModal'
import SSText from '@/components/SSText'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Output } from '@/types/models/Output'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { parseHexToBytes } from '@/utils/parse'
import { estimateTransactionSize } from '@/utils/transaction'

const tn = _tn('transaction.build.preview')

function PreviewMessage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [inputs, outputs, fee, feeRate, rbf, setTxBuilderResult] =
    useTransactionBuilderStore(
      useShallow((state) => [
        state.inputs,
        state.outputs,
        state.fee,
        state.feeRate,
        state.rbf,
        state.setTxBuilderResult
      ])
    )
  const account = useAccountsStore((state) =>
    state.accounts.find((account) => account.id === id)
  )
  const wallet = useGetAccountWallet(id!)
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const [messageId, setMessageId] = useState('')

  const [noKeyModalVisible, setNoKeyModalVisible] = useState(false)

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
    const { size, vsize } = estimateTransactionSize(inputs.size, outputs.length)

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
            fee,
            options: {
              rbf
            }
          },
          network as Network
        )

        // transactionMessage.txDetails.transaction.output()
        // transactionMessage.txDetails.transaction.input()

        setMessageId(transactionMessage.txDetails.txid)
        setTxBuilderResult(transactionMessage)
      } catch (err) {
        toast.error(String(err))
      }
    }

    getTransactionMessage()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!id || !account) return <Redirect href="/" />

  return (
    <>
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
            </SSVStack>
          </ScrollView>
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
              {tn('noKey')}
            </SSText>
          </SSVStack>
          <SSVStack itemsCenter style={styles.modalStack}>
            <SSText center>{tn('keyInput')}</SSText>
            <SSButton label="Seed" />
            <SSButton label="WIF" />
            <SSButton label="NFC Card" />
          </SSVStack>
          <SSVStack itemsCenter style={styles.modalStack}>
            <SSText center>{tn('psbt')}</SSText>
            <SSButton label="QR Code" />
            <SSButton label="NFC" />
            <SSButton label="Share" />
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
