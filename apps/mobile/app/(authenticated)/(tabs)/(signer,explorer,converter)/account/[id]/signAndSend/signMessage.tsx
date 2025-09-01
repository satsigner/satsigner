import { Redirect, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { broadcastTransaction, getBlockchain, signTransaction } from '@/api/bdk'
import ElectrumClient from '@/api/electrum'
import { SSIconSuccess } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import { getBlockchainConfig } from '@/config/servers'
import useGetAccountWallet from '@/hooks/useGetAccountWallet'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress } from '@/utils/format'
import { bytesToHex } from '@/utils/scripts'

const tn = _tn('transaction.build.sign')

export default function SignMessage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [txBuilderResult, psbt, setPsbt, signedTx] = useTransactionBuilderStore(
    useShallow((state) => [
      state.txBuilderResult,
      state.psbt,
      state.setPsbt,
      state.signedTx
    ])
  )
  const account = useAccountsStore(
    useShallow((state) => state.accounts.find((account) => account.id === id))
  )
  const wallet = useGetAccountWallet(id!)
  const [selectedNetwork, configs] = useBlockchainStore(
    useShallow((state) => [state.selectedNetwork, state.configs])
  )

  const currentConfig = configs[selectedNetwork]

  const [signed, setSigned] = useState(false)
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcasted, setBroadcasted] = useState(false)

  const [rawTx, setRawTx] = useState('')

  async function handleBroadcastTransaction() {
    if (!psbt && !signedTx) return
    setBroadcasting(true)

    const opts = {
      retries: currentConfig.config.retries,
      stopGap: currentConfig.config.stopGap,
      timeout: currentConfig.config.timeout
    }
    const blockchainConfig = getBlockchainConfig(
      currentConfig.server.backend,
      currentConfig.server.url,
      opts
    )
    const blockchain = await getBlockchain(
      currentConfig.server.backend,
      blockchainConfig
    )

    try {
      let broadcasted = false
      if (signedTx) {
        // For multisig wallets, broadcast the finalized transaction hex directly

        // Validate signedTx format
        if (
          !signedTx ||
          typeof signedTx !== 'string' ||
          signedTx.length === 0
        ) {
          throw new Error('Invalid signedTx: empty or invalid format')
        }

        // Basic hex validation
        if (!/^[a-fA-F0-9]+$/.test(signedTx)) {
          throw new Error('Invalid signedTx: not a valid hex string')
        }

        // Check minimum length for a valid Bitcoin transaction
        if (signedTx.length < 100) {
          throw new Error(
            'Invalid signedTx: too short to be a valid transaction'
          )
        }

        if (currentConfig.server.backend === 'electrum') {
          // Use Electrum client for electrum backends
          const electrumClient = await ElectrumClient.initClientFromUrl(
            currentConfig.server.url,
            selectedNetwork
          )
          await electrumClient.broadcastTransactionHex(signedTx)
          electrumClient.close()
          broadcasted = true
        } else if (currentConfig.server.backend === 'esplora') {
          // Use Esplora client for esplora backends
          const { default: Esplora } = await import('@/api/esplora')
          const esploraClient = new Esplora(currentConfig.server.url)
          await esploraClient.broadcastTransaction(signedTx)
          broadcasted = true
        } else {
          throw new Error(
            `Unsupported backend: ${currentConfig.server.backend}`
          )
        }
      } else if (psbt) {
        // For singlesig wallets, broadcast the PSBT
        broadcasted = await broadcastTransaction(psbt, blockchain)
      }

      if (broadcasted) {
        setBroadcasted(true)
        router.navigate(`/account/${id}/signAndSend/messageConfirmation`)
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String(err.message)
            : typeof err === 'object' && err !== null
              ? JSON.stringify(err)
              : String(err)
      toast.error(errorMessage)
    } finally {
      setBroadcasting(false)
    }
  }

  useEffect(() => {
    async function signTransactionMessage() {
      // For multisig wallets, if we already have a finalized transaction, use it directly
      if (signedTx) {
        setSigned(true)
        setRawTx(signedTx)
        return
      }

      // For singlesig wallets, sign the transaction
      if (!wallet || !txBuilderResult) return

      const partiallySignedTransaction = await signTransaction(
        txBuilderResult,
        wallet
      )

      setSigned(true)
      setPsbt(partiallySignedTransaction)
      const tx = await partiallySignedTransaction.extractTx()
      const bytes = await tx.serialize()
      const hex = bytesToHex(bytes)
      setRawTx(hex)
    }

    signTransactionMessage()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!account || !txBuilderResult) return <Redirect href="/" />

  return (
    <>
      <SSMainLayout style={{ paddingTop: 0, paddingBottom: 20 }}>
        <ScrollView>
          <SSVStack itemsCenter justifyBetween style={{ minHeight: '100%' }}>
            <SSVStack itemsCenter>
              <SSText size="lg" weight="bold">
                {account?.policyType === 'multisig' && signedTx
                  ? tn('readyToBroadcast')
                  : tn(signed ? 'signed' : 'signing')}
              </SSText>
              <SSText color="muted" size="sm" weight="bold" uppercase>
                {tn('messageId')}
              </SSText>
              <SSText size="lg">
                {formatAddress(txBuilderResult.txDetails.txid)}
              </SSText>
              {signed && !broadcasted && (
                <SSIconSuccess width={159} height={159} variant="outline" />
              )}
              {!signed && !broadcasted && (
                <ActivityIndicator size={160} color="#fff" />
              )}
              {broadcasted && (
                <SSIconSuccess width={159} height={159} variant="filled" />
              )}
            </SSVStack>

            <SSVStack>
              <SSVStack gap="xxs">
                <SSText color="muted" size="sm" uppercase>
                  {tn('messageId')}
                </SSText>
                <SSText size="lg">{txBuilderResult.txDetails.txid}</SSText>
              </SSVStack>

              <SSVStack gap="xxs">
                <SSText
                  color="muted"
                  size="sm"
                  uppercase
                  style={{ marginBottom: -22 }}
                >
                  {tn('message')}
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
                      } catch (_error) {
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
              label={t('send.broadcast')}
              disabled={!signed || (!psbt && !signedTx)}
              loading={broadcasting}
              onPress={() => {
                handleBroadcastTransaction()
              }}
            />
            {(() => {
              const _isDisabled = !signed || (!psbt && !signedTx)
              return null
            })()}
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}
