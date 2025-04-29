// React and React Native imports
// External dependencies
import { type Network } from 'bdk-rn/lib/lib/enums'
import * as bitcoinjs from 'bitcoinjs-lib'
import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

// Internal imports
import { buildTransaction } from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSGradientModal from '@/components/SSGradientModal'
import SSModal from '@/components/SSModal'
import SSQRCode from '@/components/SSQRCode'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { useWalletsStore } from '@/store/wallets'
import { Colors, Typography } from '@/styles'
import { type Output } from '@/types/models/Output'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { createBBQRChunks } from '@/utils/bbqr'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { parseHexToBytes } from '@/utils/parse'
import { estimateTransactionSize } from '@/utils/transaction'

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
  const [currentChunk, setCurrentChunk] = useState(0)
  const [showRawPsbt, setShowRawPsbt] = useState(false)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [signedPsbt, setSignedPsbt] = useState('')
  const [permission, requestPermission] = useCameraPermissions()

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

  const [qrChunks, setQrChunks] = useState<string[]>([])
  const [qrError, setQrError] = useState<string | null>(null)
  const [serializedPsbt, setSerializedPsbt] = useState<string>('')

  const getPsbtString = useCallback(async () => {
    if (!txBuilderResult?.psbt) {
      toast.error(t('error.psbt.notAvailable'))
      return null
    }

    try {
      const serializedPsbt = await txBuilderResult.psbt.serialize()
      // Get raw bytes from serialized PSBT
      const bytes = Uint8Array.from(serializedPsbt)

      // Create BBQR chunks with max chunk size of 400
      const bbqrChunks = createBBQRChunks(bytes, 400)

      setQrChunks(bbqrChunks)
      setSerializedPsbt(serializedPsbt)

      return serializedPsbt
    } catch (_e) {
      toast.error(t('error.psbt.serialization'))
      return null
    }
  }, [txBuilderResult])

  useEffect(() => {
    const updateQrChunks = async () => {
      try {
        const psbtString = await getPsbtString()
        if (!psbtString) {
          setQrError(t('error.psbt.notAvailable'))
          setQrChunks([]) // Set empty array instead of undefined
          return
        }

        try {
          // Create BBQR chunks
          const bbqrChunks = createBBQRChunks(Uint8Array.from(psbtString))
          setQrChunks(bbqrChunks)
          setQrError(null)
        } catch (_e) {
          setQrError(t('error.qr.generation'))
          setQrChunks([]) // Set empty array instead of undefined
        }
      } catch (_e) {
        setQrError(t('error.psbt.notAvailable'))
        setQrChunks([]) // Set empty array instead of undefined
      }
    }

    updateQrChunks()
  }, [getPsbtString])

  // Auto-advance chunks for animated QR
  useEffect(() => {
    if (!qrChunks || qrChunks.length <= 1) return

    const interval = setInterval(() => {
      setCurrentChunk((prev) => (prev + 1) % qrChunks.length)
    }, 1000) // Change chunk every second

    return () => clearInterval(interval)
  }, [qrChunks])

  const handleQRCodeScanned = (data: string | undefined) => {
    if (!data) {
      toast.error('Failed to scan QR code')
      return
    }
    setCameraModalVisible(false)
    // Set the scanned QR code data in the input field
    setSignedPsbt(data)
    toast.success('QR code scanned successfully')
  }

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
                      {t('transaction.preview.exportUnsigned')}
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
                      {t('transaction.preview.importSigned')}
                    </SSText>
                    <SSTextInput
                      placeholder={t('sign.signedPsbt')}
                      editable={false}
                      style={{
                        marginVertical: 8,
                        fontFamily: Typography.terminessNerdFontMonoRegular
                      }}
                      value={signedPsbt}
                      multiline
                      numberOfLines={8}
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
                        onPress={() => setCameraModalVisible(true)}
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
                    <SSButton
                      label="Check Signature"
                      style={{ marginTop: 26 }}
                      variant="secondary"
                      disabled={!signedPsbt}
                      onPress={() =>
                        router.navigate(
                          `/account/${id}/signAndSend/signMessage`
                        )
                      }
                    />
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
          <SSVStack style={{ marginTop: 12 }} itemsCenter>
            <SSText color="muted" size="lg" uppercase>
              {t('transaction.preview.PSBT')}
            </SSText>
            {qrError ? (
              <SSText color="muted" size="sm" style={{ marginTop: 16 }}>
                {qrError}
              </SSText>
            ) : qrChunks.length > 0 ? (
              <>
                <View
                  style={{
                    padding: 10,
                    backgroundColor: Colors.white,
                    width: '100%',
                    alignItems: 'center'
                  }}
                >
                  {showRawPsbt ? (
                    <SSQRCode
                      value={serializedPsbt}
                      color={Colors.black}
                      backgroundColor={Colors.white}
                      size={300}
                    />
                  ) : (
                    <SSQRCode
                      value={qrChunks?.[currentChunk] || ''}
                      color={Colors.black}
                      backgroundColor={Colors.white}
                      size={300}
                    />
                  )}
                </View>

                <SSText
                  center
                  color="muted"
                  size="sm"
                  style={{ marginTop: 8, maxWidth: 300, height: 60 }}
                >
                  {showRawPsbt
                    ? serializedPsbt.length > 150
                      ? `${serializedPsbt.slice(0, 150)}...`
                      : serializedPsbt
                    : qrChunks?.[currentChunk]?.length > 150
                      ? `${qrChunks[currentChunk].slice(0, 150)}...`
                      : qrChunks?.[currentChunk] || ''}
                </SSText>
                <SSText center color="muted" size="sm" style={{ marginTop: 8 }}>
                  {!showRawPsbt && qrChunks.length > 1
                    ? t('transaction.preview.scanAllChunks', {
                        current: currentChunk + 1,
                        total: qrChunks.length
                      })
                    : !showRawPsbt && qrChunks.length === 1
                      ? t('transaction.preview.singleChunk')
                      : t('transaction.preview.rawPSBT')}
                </SSText>

                <SSButton
                  variant="outline"
                  label={
                    showRawPsbt
                      ? t('transaction.preview.showBBQR')
                      : t('transaction.preview.showRaw')
                  }
                  onPress={() => setShowRawPsbt(!showRawPsbt)}
                  style={{ marginBottom: 1, width: '100%' }}
                />
              </>
            ) : (
              <SSText color="muted" size="sm" style={{ marginTop: 16 }}>
                {t('common.loading')}
              </SSText>
            )}
          </SSVStack>
        </SSGradientModal>
        <SSModal
          visible={cameraModalVisible}
          fullOpacity
          onClose={() => setCameraModalVisible(false)}
        >
          <SSText color="muted" uppercase>
            {t('camera.scanQRCode')}
          </SSText>
          <CameraView
            onBarcodeScanned={(res) => handleQRCodeScanned(res.raw)}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            style={{ width: 340, height: 340 }}
          />
          {!permission?.granted && (
            <SSButton
              label={t('camera.enableCameraAccess')}
              onPress={requestPermission}
            />
          )}
        </SSModal>
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
