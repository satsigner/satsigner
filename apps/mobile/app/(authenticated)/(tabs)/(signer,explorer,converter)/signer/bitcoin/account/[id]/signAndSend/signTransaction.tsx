import * as Clipboard from 'expo-clipboard'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Psbt, type PsbtLike } from 'react-native-bdk-sdk'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { broadcastTransaction, signTransaction } from '@/api/bdk'
import ElectrumClient from '@/api/electrum'
import Esplora from '@/api/esplora'
import { SSIconSuccess } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSLoader from '@/components/SSLoader'
import SSText from '@/components/SSText'
import SSTransactionChart from '@/components/SSTransactionChart'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import SSTransactionIdFormatted from '@/components/SSTransactionIdFormatted'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useNostrStore } from '@/store/nostr'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type Output } from '@/types/models/Output'
import { type Transaction } from '@/types/models/Transaction'
import { type Utxo } from '@/types/models/Utxo'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { legacyEstimateTransactionSize } from '@/utils/transaction'

const tn = _tn('transaction.build.sign')

function getBdkInnerMessage(error: unknown): string | undefined {
  if (!(error instanceof Error) || !('inner' in error)) {
    return undefined
  }
  const record = error as { inner?: unknown }
  const { inner } = record
  if (!inner || typeof inner !== 'object' || !('message' in inner)) {
    return undefined
  }
  const msg = (inner as { message: unknown }).message
  if (typeof msg !== 'string' || msg.length === 0) {
    return undefined
  }
  return msg
}

function broadcastFailureUserMessage(error: unknown): string {
  const inner = getBdkInnerMessage(error)
  if (inner) {
    return inner
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Failed to broadcast transaction'
}

export default function SignTransaction() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [
    psbt,
    setPsbt,
    signedTx,
    inputs,
    outputs,
    broadcasted,
    setBroadcasted
  ] = useTransactionBuilderStore(
    useShallow((state) => [
      state.psbt,
      state.setPsbt,
      state.signedTx,
      state.inputs,
      state.outputs,
      state.broadcasted,
      state.setBroadcasted
    ])
  )
  const account = useAccountsStore(
    useShallow((state) => state.accounts.find((account) => account.id === id))
  )
  const ownAddresses = new Set(account?.addresses?.map((a) => a.address))
  const setTransactionToShare = useNostrStore(
    (state) => state.setTransactionToShare
  )
  const wallet = useGetAccountWallet(id!)
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )

  const currentConfig = configs[selectedNetwork]

  const [signed, setSigned] = useState(false)
  const [broadcasting, setBroadcasting] = useState(false)
  const [rawTx, setRawTx] = useState('')

  const trimmedRawTx = rawTx.trim()
  const canCopySignedTx =
    signed &&
    !!rawTx &&
    trimmedRawTx.length >= 20 &&
    /^[0-9a-fA-F]+$/.test(trimmedRawTx) &&
    !trimmedRawTx.toLowerCase().startsWith('70736274')

  async function handleCopySignedTx() {
    if (!canCopySignedTx) {
      toast.error(tn('copySignedTxUnavailable'))
      return
    }
    try {
      await Clipboard.setStringAsync(trimmedRawTx)
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error(tn('copySignedTxUnavailable'))
    }
  }

  const transaction = buildTransaction(psbt ?? null, inputs, outputs)

  function buildTransaction(
    psbt: PsbtLike | null,
    inputs: Map<string, Utxo>,
    outputs: Output[]
  ): Transaction | null {
    if (!psbt) {
      return null
    }

    const { size, vsize } = legacyEstimateTransactionSize(
      inputs.size,
      outputs.length
    )

    const vin = Array.from(inputs.values()).map((input: Utxo) => ({
      label: input.label || '',
      previousOutput: { txid: input.txid, vout: input.vout },
      scriptSig: '' as string | number[],
      sequence: 0,
      value: input.value,
      witness: [] as number[][]
    }))

    const vout = outputs.map((output: Output) => ({
      address: output.to,
      label: output.label || '',
      script: '' as string | number[],
      value: output.amount
    }))

    return {
      id: psbt.txid(),
      lockTimeEnabled: false,
      prices: {},
      received: 0,
      sent: 0,
      size,
      type: 'send' as const,
      vin,
      vout,
      vsize
    }
  }

  function handleBroadcastSingleSig() {
    if (!psbt || !wallet) {
      console.log('[SignTransaction] handleBroadcastSingleSig abort', {
        hasPsbt: !!psbt,
        hasWallet: !!wallet
      })
      throw new Error('Empty PSBT or wallet')
    }
    console.log('[SignTransaction] handleBroadcastSingleSig start', {
      backend: currentConfig.server.backend,
      url: currentConfig.server.url
    })
    return broadcastTransaction(
      wallet,
      psbt,
      currentConfig.server.backend,
      currentConfig.server.url
    ).then((txid) => {
      console.log('[SignTransaction] handleBroadcastSingleSig result', {
        falsy: !txid,
        txid
      })
      return txid
    })
  }

  async function handleBroadcastMultiSig() {
    console.log('[SignTransaction] handleBroadcastMultiSig start', {
      backend: currentConfig.server.backend,
      signedTxLength: signedTx?.length ?? 0,
      url: currentConfig.server.url
    })

    if (!signedTx) {
      throw new Error('Empty signed transaction')
    }

    if (typeof signedTx !== 'string' || signedTx.length === 0) {
      throw new Error('Invalid signedTx: empty or invalid format')
    }

    if (!/^[a-fA-F0-9]+$/.test(signedTx)) {
      throw new Error('Invalid signedTx: not a valid hex string')
    }

    if (signedTx.length < 100) {
      throw new Error('Invalid signedTx: too short to be a valid transaction')
    }

    if (currentConfig.server.backend === 'electrum') {
      const electrumClient = await ElectrumClient.initClientFromUrl(
        currentConfig.server.url,
        selectedNetwork
      )
      console.log('[SignTransaction] multisig electrum broadcasting…')
      await electrumClient.broadcastTransactionHex(signedTx)
      electrumClient.close()
      console.log('[SignTransaction] multisig electrum broadcast ok')
      return true
    }

    if (currentConfig.server.backend === 'esplora') {
      const esploraClient = new Esplora(currentConfig.server.url)
      console.log('[SignTransaction] multisig esplora broadcasting…')
      const txid = await esploraClient.broadcastTransaction(signedTx)
      console.log('[SignTransaction] multisig esplora broadcast ok', { txid })
      return true
    }

    throw new Error(`Unsupported backend: ${currentConfig.server.backend}`)
  }

  async function handleBroadcastTransaction() {
    console.log('[SignTransaction] handleBroadcastTransaction invoked', {
      broadcasted,
      broadcasting,
      hasPsbt: !!psbt,
      hasSignedTx: !!signedTx,
      hasWallet: !!wallet,
      signed
    })

    if (broadcasting) {
      console.log('[SignTransaction] skip: already broadcasting')
      toast.info('Please wait while the transaction is being broadcast.')
      return
    }

    if (broadcasted) {
      console.log('[SignTransaction] skip: already broadcasted')
      toast.error(
        'This transaction has already been broadcasted to the network'
      )
      return
    }

    setBroadcasting(true)

    try {
      if (signedTx) {
        console.log('[SignTransaction] branch: multisig (signedTx)')
        await handleBroadcastMultiSig()
      } else if (psbt) {
        console.log('[SignTransaction] branch: singlesig (psbt)')
        const broadcastResult = await handleBroadcastSingleSig()
        if (!broadcastResult) {
          console.log('[SignTransaction] singlesig broadcast empty result')
          throw new Error('Broadcast failed')
        }
      } else {
        console.log('[SignTransaction] branch: none — no psbt or signedTx')
        throw new Error('No transaction to broadcast')
      }

      console.log('[SignTransaction] broadcast success, navigating…')
      setBroadcasted(true)
      router.navigate(
        `/signer/bitcoin/account/${id}/signAndSend/transactionConfirmation`
      )
    } catch (error) {
      console.log('[SignTransaction] broadcast error', {
        error,
        innerMessage: getBdkInnerMessage(error),
        message: error instanceof Error ? error.message : String(error)
      })
      toast.error(broadcastFailureUserMessage(error))
    } finally {
      setBroadcasting(false)
      console.log('[SignTransaction] handleBroadcastTransaction finished')
    }
  }

  function handleShareWithNostrGroup() {
    if (!account?.nostr?.autoSync) {
      toast.error(t('account.nostrSync.autoSyncMustBeEnabled'))
      return
    }
    const txString = psbt?.toBase64() ?? signedTx ?? ''
    if (!txString) {
      toast.error(t('account.nostrSync.transactionDataNotAvailable'))
      return
    }
    setTransactionToShare({
      transaction: txString,
      transactionData: { combinedPsbt: txString }
    })
    router.push({
      params: { id },
      pathname: '/signer/bitcoin/account/[id]/settings/nostr/devicesGroupChat'
    })
  }

  useEffect(() => {
    function signTransactionData() {
      console.log('[SignTransaction] signTransactionData (mount)', {
        hasPsbt: !!psbt,
        hasSignedTx: !!signedTx,
        hasWallet: !!wallet
      })
      // For multisig wallets, if we already have a finalized transaction, use it directly
      if (signedTx) {
        setSigned(true)
        setRawTx(signedTx)
        console.log('[SignTransaction] multisig path: using signedTx as raw')
        return
      }

      // For singlesig wallets, sign the transaction
      if (!wallet || !psbt) {
        console.log('[SignTransaction] singlesig path: missing wallet or psbt')
        return
      }

      const signOk = signTransaction(psbt, wallet)
      console.log('[SignTransaction] wallet.sign returned', { signOk })

      try {
        // Create fresh reference so Zustand detects the change
        const signedPsbt = new Psbt(psbt.toBase64())
        setSigned(true)
        setPsbt(signedPsbt)
        const hex = psbt.extractTxHex()
        console.log('[SignTransaction] extractTxHex ok', {
          hexLength: hex.length
        })
        setRawTx(hex)
      } catch (error) {
        console.log('[SignTransaction] singlesig finalize failed', {
          error: error,
          message: error instanceof Error ? error.message : String(error)
        })
        throw error
      }
    }

    signTransactionData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!signed) {
      return
    }
    const broadcastDisabled = !signed || (!psbt && !signedTx) || broadcasted
    console.log('[SignTransaction] signed state', {
      broadcastDisabled,
      broadcasted,
      canCopySignedTx,
      hasPsbt: !!psbt,
      hasSignedTx: !!signedTx,
      hasWallet: !!wallet,
      rawTxLength: rawTx.length
    })
  }, [signed, psbt, signedTx, broadcasted, wallet, rawTx, canCopySignedTx])

  if (!account || !psbt) {
    return <Redirect href="/" />
  }

  return (
    <>
      <SSMainLayout style={{ paddingBottom: 20, paddingTop: 0 }}>
        <ScrollView>
          <SSVStack justifyBetween style={{ minHeight: '100%' }}>
            <SSVStack itemsCenter>
              <SSText size="md" uppercase weight="light">
                {broadcasted
                  ? t('sent.broadcasted')
                  : account?.policyType === 'multisig' && signedTx
                    ? tn('readyToBroadcast')
                    : tn(signed ? 'signed' : 'signing')}
              </SSText>

              {signed && !broadcasted && (
                <SSIconSuccess width={159} height={159} variant="outline" />
              )}
              {!signed && !broadcasted && <SSLoader size={160} />}
              {broadcasted && (
                <SSIconSuccess width={159} height={159} variant="filled" />
              )}
            </SSVStack>

            <SSVStack>
              <SSVStack gap="xxs">
                <SSText color="muted" size="sm" uppercase>
                  {t('transaction.id')}
                </SSText>
                <SSTransactionIdFormatted size="lg" value={psbt.txid()} />
              </SSVStack>

              <SSVStack gap="xxs">
                <SSText color="muted" size="sm" uppercase>
                  {t('transaction.build.preview.contents')}
                </SSText>
                {transaction && (
                  <View style={{ overflow: 'hidden', width: '100%' }}>
                    <SSTransactionChart
                      transaction={transaction}
                      ownAddresses={ownAddresses}
                      scale={0.9}
                    />
                  </View>
                )}
              </SSVStack>
              <SSVStack gap="xxs">
                <SSText
                  color="muted"
                  size="sm"
                  uppercase
                  style={{ marginBottom: -22 }}
                >
                  {tn('transaction')}
                </SSText>
                {rawTx !== '' && (
                  <>
                    {(() => {
                      const isValidHex =
                        /^[a-fA-F0-9]+$/.test(rawTx) && rawTx.length >= 8

                      if (!isValidHex) {
                        return (
                          <SSText color="muted" size="sm">
                            Invalid transaction format:{' '}
                            {rawTx.substring(0, 100)}
                            ...
                          </SSText>
                        )
                      }

                      // Check if this might be PSBT data (starts with specific PSBT magic bytes)
                      const isPossiblyPSBT = rawTx
                        .toLowerCase()
                        .startsWith('70736274')

                      if (isPossiblyPSBT) {
                        return (
                          <SSText color="muted" size="sm">
                            PSBT format detected - Cannot display raw
                            transaction view. Transaction will be processed for
                            broadcasting.
                          </SSText>
                        )
                      }

                      // Try to decode as raw transaction
                      try {
                        return <SSTransactionDecoded txHex={rawTx} />
                      } catch {
                        return (
                          <SSText color="muted" size="sm">
                            Unable to decode transaction format. Data will be
                            processed for broadcasting.
                          </SSText>
                        )
                      }
                    })()}
                  </>
                )}
              </SSVStack>
            </SSVStack>

            <SSButton
              variant="secondary"
              label={broadcasted ? t('sent.broadcasted') : t('send.broadcast')}
              disabled={!signed || (!psbt && !signedTx) || broadcasted}
              loading={broadcasting}
              onPress={() => {
                console.log('[SignTransaction] Broadcast button onPress', {
                  broadcasted,
                  broadcasting,
                  disabled: !signed || (!psbt && !signedTx) || broadcasted,
                  hasPsbt: !!psbt,
                  hasSignedTx: !!signedTx,
                  signed
                })
                handleBroadcastTransaction()
              }}
            />
            {signed && (
              <SSButton
                variant="ghost"
                disabled={!canCopySignedTx || broadcasting}
                label={tn('copySignedTx')}
                onPress={handleCopySignedTx}
              />
            )}
            {signed &&
              account?.nostr?.autoSync &&
              (psbt?.toBase64() ?? signedTx) && (
                <SSButton
                  variant="ghost"
                  label={t('account.nostrSync.shareWithGroup')}
                  disabled={broadcasting}
                  onPress={handleShareWithNostrGroup}
                />
              )}
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}
