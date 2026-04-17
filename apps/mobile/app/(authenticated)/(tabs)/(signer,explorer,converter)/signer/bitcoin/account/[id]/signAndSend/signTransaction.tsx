import * as Clipboard from 'expo-clipboard'
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Psbt } from 'react-native-bdk-sdk'
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
import SSTransactionIdFormatted from '@/components/SSTransactionIdFormatted'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
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

const BROADCAST_LOG_PREFIX = '[SignTransaction broadcast]'

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
  const ownAddresses = useMemo(
    () => new Set(account?.addresses?.map((a) => a.address)),
    [account]
  )
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

  const canCopySignedTx = useMemo(() => {
    if (!signed || !rawTx) {
      return false
    }
    const hex = rawTx.trim()
    if (hex.length < 20 || !/^[0-9a-fA-F]+$/.test(hex)) {
      return false
    }
    if (hex.toLowerCase().startsWith('70736274')) {
      return false
    }
    return true
  }, [rawTx, signed])

  const handleCopySignedTx = useCallback(async () => {
    if (!canCopySignedTx) {
      toast.error(tn('copySignedTxUnavailable'))
      return
    }
    try {
      await Clipboard.setStringAsync(rawTx.trim())
      toast.success(t('common.copiedToClipboard'))
    } catch {
      toast.error(tn('copySignedTxUnavailable'))
    }
  }, [canCopySignedTx, rawTx, t, tn])

  const transaction = useMemo(() => {
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
      value: input.value
    }))

    const vout = outputs.map((output: Output) => ({
      address: output.to,
      label: output.label || '',
      value: output.amount
    }))

    return {
      id: psbt.txid(),
      size,
      vin,
      vout,
      vsize
    } as never as Transaction
  }, [inputs, outputs, psbt])

  function handleBroadcastSingleSig() {
    console.log(BROADCAST_LOG_PREFIX, 'handleBroadcastSingleSig start', {
      hasPsbt: Boolean(psbt),
      hasWallet: Boolean(wallet),
      backend: currentConfig?.server?.backend,
      url: currentConfig?.server?.url
    })
    if (!psbt || !wallet) {
      console.error(BROADCAST_LOG_PREFIX, 'handleBroadcastSingleSig abort', {
        hasPsbt: Boolean(psbt),
        hasWallet: Boolean(wallet)
      })
      throw new Error('Empty PSBT or wallet')
    }
    return broadcastTransaction(
      wallet,
      psbt,
      currentConfig.server.backend,
      currentConfig.server.url
    )
  }

  async function handleBroadcastMultiSig() {
    console.log(BROADCAST_LOG_PREFIX, 'handleBroadcastMultiSig start', {
      signedTxLength: signedTx?.length,
      signedTxPrefix: typeof signedTx === 'string' ? signedTx.slice(0, 32) : null,
      backend: currentConfig?.server?.backend,
      url: currentConfig?.server?.url
    })
    if (!signedTx) {
      console.error(BROADCAST_LOG_PREFIX, 'multisig: missing signedTx')
      throw new Error('Empty signed transaction')
    }

    if (typeof signedTx !== 'string' || signedTx.length === 0) {
      console.error(BROADCAST_LOG_PREFIX, 'multisig: signedTx not non-empty string')
      throw new Error('Invalid signedTx: empty or invalid format')
    }

    if (!/^[a-fA-F0-9]+$/.test(signedTx)) {
      console.error(BROADCAST_LOG_PREFIX, 'multisig: signedTx failed hex regex')
      throw new Error('Invalid signedTx: not a valid hex string')
    }

    if (signedTx.length < 100) {
      console.error(BROADCAST_LOG_PREFIX, 'multisig: signedTx too short', {
        length: signedTx.length
      })
      throw new Error('Invalid signedTx: too short to be a valid transaction')
    }

    if (currentConfig.server.backend === 'electrum') {
      console.log(BROADCAST_LOG_PREFIX, 'multisig: broadcasting via electrum')
      const electrumClient = await ElectrumClient.initClientFromUrl(
        currentConfig.server.url,
        selectedNetwork
      )
      const txid = await electrumClient.broadcastTransactionHex(signedTx)
      console.log(BROADCAST_LOG_PREFIX, 'multisig: electrum broadcast ok', {
        txid
      })
      electrumClient.close()
      return true
    }

    if (currentConfig.server.backend === 'esplora') {
      console.log(BROADCAST_LOG_PREFIX, 'multisig: broadcasting via esplora')
      const esploraClient = new Esplora(currentConfig.server.url)
      const txid = await esploraClient.broadcastTransaction(signedTx)
      console.log(BROADCAST_LOG_PREFIX, 'multisig: esplora broadcast ok', {
        txid
      })
      return true
    }

    console.error(BROADCAST_LOG_PREFIX, 'multisig: unsupported backend', {
      backend: currentConfig.server.backend
    })
    throw new Error(`Unsupported backend: ${currentConfig.server.backend}`)
  }

  async function handleBroadcastTransaction() {
    console.log(BROADCAST_LOG_PREFIX, 'tap: handleBroadcastTransaction', {
      broadcasting,
      broadcasted,
      hasSignedTx: Boolean(signedTx),
      hasPsbt: Boolean(psbt),
      signed,
      accountId: id
    })
    if (broadcasting) {
      console.log(BROADCAST_LOG_PREFIX, 'ignored: already broadcasting')
      toast.info('Please wait while the transaction is being broadcast.')
      return
    }

    if (broadcasted) {
      console.log(BROADCAST_LOG_PREFIX, 'ignored: already broadcasted')
      toast.error(
        'This transaction has already been broadcasted to the network'
      )
      return
    }

    setBroadcasting(true)

    try {
      if (signedTx) {
        console.log(BROADCAST_LOG_PREFIX, 'path: multisig (signedTx)')
        await handleBroadcastMultiSig()
      } else if (psbt) {
        console.log(BROADCAST_LOG_PREFIX, 'path: singlesig (psbt → BDK)')
        const broadcastResult = await handleBroadcastSingleSig()
        console.log(BROADCAST_LOG_PREFIX, 'singlesig broadcast returned', {
          type: typeof broadcastResult,
          value: broadcastResult,
          truthy: Boolean(broadcastResult)
        })
        if (!broadcastResult) {
          console.error(
            BROADCAST_LOG_PREFIX,
            'singlesig: falsy result from broadcastTransaction — treating as failure'
          )
          throw new Error('Broadcast failed')
        }
      } else {
        console.error(BROADCAST_LOG_PREFIX, 'no signedTx and no psbt')
        throw new Error('No transaction to broadcast')
      }

      console.log(BROADCAST_LOG_PREFIX, 'success, navigating to confirmation')
      setBroadcasted(true)
      router.navigate(
        `/signer/bitcoin/account/${id}/signAndSend/transactionConfirmation`
      )
    } catch (error) {
      console.error(BROADCAST_LOG_PREFIX, 'catch', error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to broadcast transaction'
      toast.error(errorMessage)
    } finally {
      console.log(BROADCAST_LOG_PREFIX, 'finally: setBroadcasting(false)')
      setBroadcasting(false)
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
      // For multisig wallets, if we already have a finalized transaction, use it directly
      if (signedTx) {
        setSigned(true)
        setRawTx(signedTx)
        return
      }

      // For singlesig wallets, sign the transaction
      if (!wallet || !psbt) {
        return
      }

      signTransaction(psbt, wallet)

      // Create fresh reference so Zustand detects the change
      const signedPsbt = new Psbt(psbt.toBase64())
      setSigned(true)
      setPsbt(signedPsbt)
      const hex = psbt.extractTxHex()
      setRawTx(hex)
    }

    signTransactionData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
