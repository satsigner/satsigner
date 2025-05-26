// React and React Native imports
// External dependencies
import { type Network } from 'bdk-rn/lib/lib/enums'
import * as bitcoinjs from 'bitcoinjs-lib'
import { CameraView, useCameraPermissions } from 'expo-camera/next'
import * as Clipboard from 'expo-clipboard'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
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
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
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
import { useNFCReader } from '@/hooks/useNFCReader'
import { useNFCEmitter } from '@/hooks/useNFCEmitter'
import { getURFragmentsFromPSBT } from '@/utils/ur'
import { encodePSBTToUR } from '@/utils/ur'

const tn = _tn('transaction.build.preview')

enum QRDisplayMode {
  RAW = 'RAW',
  UR = 'UR',
  BBQR = 'BBQR'
}

interface NFCTagWithNDEF {
  ndefMessage?: Array<{
    tnf: number
    type: Uint8Array
    payload: Uint8Array
  }>
}

function PreviewMessage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [
    inputs,
    outputs,
    fee,
    feeRate,
    rbf,
    setTxBuilderResult,
    txBuilderResult,
    setSignedTx
  ] = useTransactionBuilderStore(
    useShallow((state) => [
      state.inputs,
      state.outputs,
      state.fee,
      state.feeRate,
      state.rbf,
      state.setTxBuilderResult,
      state.txBuilderResult,
      state.setSignedTx
    ])
  )
  const account = useAccountsStore((state) =>
    state.accounts.find((account) => account.id === id)
  )
  const wallet = useGetAccountWallet(id!)
  const network = useBlockchainStore((state) => state.selectedNetwork)
  const [messageId, setMessageId] = useState('')

  const [noKeyModalVisible, setNoKeyModalVisible] = useState(false)
  const [currentChunk, setCurrentChunk] = useState(0)
  const [displayMode, setDisplayMode] = useState<QRDisplayMode>(
    QRDisplayMode.RAW
  )
  const [showRawPsbt, setShowRawPsbt] = useState(true)
  const [cameraModalVisible, setCameraModalVisible] = useState(false)
  const [signedPsbt, setSignedPsbt] = useState('')
  const [permission, requestPermission] = useCameraPermissions()

  const { isAvailable, isReading, readNFCTag, cancelNFCScan } = useNFCReader()
  const {
    isEmitting,
    emitNFCTag,
    cancelNFCScan: cancelNFCEmitterScan
  } = useNFCEmitter()
  const [nfcModalVisible, setNfcModalVisible] = useState(false)
  const [nfcScanModalVisible, setNfcScanModalVisible] = useState(false)
  const [nfcError, setNfcError] = useState<string | null>(null)

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

  const [qrChunks, setQrChunks] = useState<string[]>([])
  const [qrError, setQrError] = useState<string | null>(null)
  const [serializedPsbt, setSerializedPsbt] = useState<string>('')
  const [urChunks, setUrChunks] = useState<string[]>([])
  const [currentUrChunk, setCurrentUrChunk] = useState(0)

  const getPsbtString = useCallback(async () => {
    if (!txBuilderResult?.psbt) {
      return null
    }

    try {
      const serializedPsbt = await txBuilderResult.psbt.serialize()
      // Convert the raw bytes to a Buffer
      const psbtBuffer = Buffer.from(serializedPsbt)

      // Create BBQR chunks with very small chunk size (100 bytes) for better scanning
      const bbqrChunks = createBBQRChunks(new Uint8Array(psbtBuffer), 100)
      setQrChunks(bbqrChunks)

      // Store the hex representation for other uses
      const psbtHex = psbtBuffer.toString('hex')
      setSerializedPsbt(psbtHex)

      return psbtHex
    } catch (e) {
      console.error('PSBT serialization error:', e)
      toast.error(t('error.psbt.serialization'))
      return null
    }
  }, [txBuilderResult])

  useEffect(() => {
    const updateQrChunks = async () => {
      try {
        const psbtHex = await getPsbtString()
        if (!psbtHex) {
          setQrError(t('error.psbt.notAvailable'))
          setQrChunks([])
          setUrChunks([])
          return
        }

        try {
          // Create BBQR chunks (keep as is)
          const psbtBuffer = Buffer.from(psbtHex, 'hex')
          const bbqrChunks = createBBQRChunks(new Uint8Array(psbtBuffer), 100)
          setQrChunks(bbqrChunks)

          // Convert hex to base64 for UR encoding (BIP 174 standard)
          const psbtBase64 = Buffer.from(psbtHex, 'hex').toString('base64')
          const urFragments = getURFragmentsFromPSBT(psbtBase64, 'base64', 50)
          setUrChunks(urFragments.map((frag) => frag.toUpperCase()))
          setQrError(null)
        } catch (e) {
          console.error('QR generation error:', e)
          setQrError(t('error.qr.generation'))
          setQrChunks([])
          setUrChunks([])
        }
      } catch (e) {
        console.error('PSBT error:', e)
        setQrError(t('error.psbt.notAvailable'))
        setQrChunks([])
        setUrChunks([])
      }
    }

    updateQrChunks()
  }, [getPsbtString])

  // Keep animation speed the same but with smaller chunks
  useEffect(() => {
    if (displayMode === QRDisplayMode.BBQR && qrChunks.length > 1) {
      const interval = setInterval(() => {
        setCurrentChunk((prev) => (prev + 1) % qrChunks.length)
      }, 750)
      return () => clearInterval(interval)
    } else if (displayMode === QRDisplayMode.UR && urChunks.length > 1) {
      const interval = setInterval(() => {
        setCurrentUrChunk((prev) => (prev + 1) % urChunks.length)
      }, 750)
      return () => clearInterval(interval)
    }
  }, [displayMode, qrChunks.length, urChunks.length])

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

  async function handleNFCExport() {
    if (isEmitting) {
      await cancelNFCEmitterScan()
      setNfcModalVisible(false)
      setNfcError(null)
      return
    }

    if (!serializedPsbt) {
      toast.error(t('error.psbt.notAvailable'))
      return
    }

    setNfcModalVisible(true)
    setNfcError(null)
    try {
      await emitNFCTag(serializedPsbt)
      toast.success(t('transaction.preview.nfcExported'))
    } catch (error) {
      const errorMessage = (error as Error).message
      if (errorMessage) {
        setNfcError(errorMessage)
        toast.error(errorMessage)
      }
    } finally {
      if (!nfcError) {
        setNfcModalVisible(false)
      }
    }
  }

  async function handleNFCScan() {
    if (isReading) {
      await cancelNFCScan()
      setNfcScanModalVisible(false)
      return
    }

    setNfcScanModalVisible(true)
    try {
      const result = await readNFCTag()

      if (!result) {
        toast.error(t('watchonly.read.nfcErrorNoData'))
        return
      }

      if (result.txData) {
        const txHex = Array.from(result.txData)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')
        setSignedPsbt(txHex)
        toast.success(t('watchonly.read.success'))
      } else if (result.txId) {
        setSignedPsbt(result.txId)
        toast.success(t('watchonly.read.success'))
      } else {
        toast.error(t('watchonly.read.nfcErrorNoData'))
      }
    } catch (error) {
      const errorMessage = (error as Error).message
      if (errorMessage) {
        toast.error(errorMessage)
      }
    } finally {
      setNfcScanModalVisible(false)
    }
  }

  useEffect(() => {
    if (signedPsbt) {
      console.log('Decoded signed transaction:', signedPsbt)
      setSignedTx(signedPsbt)
    }
  }, [signedPsbt, setSignedTx])

  useEffect(() => {
    if (txBuilderResult) {
      console.log('Transaction Builder:', {
        txid: txBuilderResult.txDetails.txid,
        psbt: txBuilderResult.psbt,
        txDetails: txBuilderResult.txDetails
      })
    }
  }, [txBuilderResult])

  const getDisplayModeLabel = () => {
    switch (displayMode) {
      case QRDisplayMode.RAW:
        return t('transaction.preview.showUR')
      case QRDisplayMode.UR:
        return t('transaction.preview.showBBQR')
      case QRDisplayMode.BBQR:
        return t('transaction.preview.showRaw')
    }
  }

  const getQRValue = () => {
    switch (displayMode) {
      case QRDisplayMode.RAW:
        return serializedPsbt
      case QRDisplayMode.UR:
        return urChunks[currentUrChunk] || ''
      case QRDisplayMode.BBQR:
        return qrChunks?.[currentChunk] || ''
    }
  }

  const getDisplayModeDescription = () => {
    switch (displayMode) {
      case QRDisplayMode.RAW:
        return t('transaction.preview.rawPSBT')
      case QRDisplayMode.UR:
        return urChunks.length > 1
          ? t('transaction.preview.scanAllChunks', {
              current: currentUrChunk + 1,
              total: urChunks.length
            })
          : t('transaction.preview.singleChunk')
      case QRDisplayMode.BBQR:
        return qrChunks.length > 1
          ? t('transaction.preview.scanAllChunks', {
              current: currentChunk + 1,
              total: qrChunks.length
            })
          : t('transaction.preview.singleChunk')
    }
  }

  const handleDisplayModeToggle = () => {
    switch (displayMode) {
      case QRDisplayMode.RAW:
        setDisplayMode(QRDisplayMode.UR)
        break
      case QRDisplayMode.UR:
        setDisplayMode(QRDisplayMode.BBQR)
        break
      case QRDisplayMode.BBQR:
        setDisplayMode(QRDisplayMode.RAW)
        break
    }
  }

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
                        label="Show QR"
                        style={{ width: '48%' }}
                        onPress={() => {
                          setNoKeyModalVisible(true)
                        }}
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
                        label={
                          isEmitting ? t('watchonly.read.scanning') : 'Emit NFC'
                        }
                        style={{ width: '48%' }}
                        variant="outline"
                        disabled={!isAvailable || !serializedPsbt}
                        onPress={handleNFCExport}
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
                      placeholder={t('transaction.preview.signedPsbt')}
                      editable={false}
                      style={{
                        fontFamily: Typography.sfProMono,
                        fontSize: 12,
                        height: 200,
                        textAlignVertical: 'top',
                        paddingTop: 12,
                        paddingBottom: 12
                      }}
                      value={signedPsbt}
                      multiline
                      numberOfLines={18}
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
                        label={
                          isReading
                            ? t('watchonly.read.scanning')
                            : t('watchonly.read.nfc')
                        }
                        style={{ width: '48%' }}
                        variant="outline"
                        disabled={!isAvailable}
                        onPress={handleNFCScan}
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
                  <SSQRCode
                    value={getQRValue()}
                    color={Colors.black}
                    backgroundColor={Colors.white}
                    size={300}
                  />
                </View>

                <SSText
                  center
                  color="muted"
                  size="sm"
                  style={{ marginTop: 8, maxWidth: 300, height: 60 }}
                >
                  {getQRValue().length > 150
                    ? `${getQRValue().slice(0, 150)}...`
                    : getQRValue()}
                </SSText>
                <SSText center color="muted" size="sm" style={{ marginTop: 8 }}>
                  {getDisplayModeDescription()}
                </SSText>

                <SSButton
                  variant="outline"
                  label={getDisplayModeLabel()}
                  onPress={handleDisplayModeToggle}
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
        <SSModal
          visible={nfcModalVisible}
          fullOpacity
          onClose={() => {
            setNfcModalVisible(false)
            setNfcError(null)
            if (isEmitting) cancelNFCEmitterScan()
          }}
        >
          <SSVStack itemsCenter gap="lg">
            <SSText color="muted" uppercase>
              {nfcError
                ? t('common.error')
                : t('transaction.preview.exportingNFC')}
            </SSText>
            {nfcError ? (
              <SSVStack itemsCenter gap="md">
                <SSText color="white" center>
                  {nfcError}
                </SSText>
                <SSText color="muted" center size="sm">
                  {t('transaction.preview.nfcExportTip')}
                </SSText>
              </SSVStack>
            ) : (
              <View
                style={{
                  width: 200,
                  height: 200,
                  backgroundColor: Colors.gray[800],
                  borderRadius: 100,
                  justifyContent: 'center',
                  alignItems: 'center'
                }}
              >
                <SSText size="lg" color="muted">
                  {isEmitting ? '...' : 'NFC'}
                </SSText>
              </View>
            )}
            <SSButton
              label={nfcError ? t('common.close') : t('common.cancel')}
              variant="ghost"
              onPress={() => {
                setNfcModalVisible(false)
                setNfcError(null)
                if (isEmitting) cancelNFCEmitterScan()
              }}
            />
          </SSVStack>
        </SSModal>
        <SSModal
          visible={nfcScanModalVisible}
          fullOpacity
          onClose={() => {
            setNfcScanModalVisible(false)
            if (isReading) cancelNFCScan()
          }}
        >
          <SSVStack itemsCenter gap="lg">
            <SSText color="muted" uppercase>
              {t('watchonly.read.scanning')}
            </SSText>
            <View
              style={{
                width: 200,
                height: 200,
                backgroundColor: Colors.gray[800],
                borderRadius: 100,
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <SSText size="lg" color="muted">
                {isReading ? '...' : 'NFC'}
              </SSText>
            </View>
            <SSButton
              label={t('common.cancel')}
              variant="ghost"
              onPress={() => {
                setNfcScanModalVisible(false)
                if (isReading) cancelNFCScan()
              }}
            />
          </SSVStack>
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
