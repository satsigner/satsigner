import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView } from 'react-native'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import { broadcastTransaction, getBlockchain, signTransaction } from '@/api/bdk'
import { SSIconSuccess } from '@/components/icons'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import { getBlockchainConfig } from '@/config/servers'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t, tn as _tn } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { useWalletsStore } from '@/store/wallets'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress } from '@/utils/format'
import { bytesToHex } from '@/utils/scripts'
import ElectrumClient from '@/api/electrum'

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
  const wallet = useWalletsStore((state) => state.wallets[id!])
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
        // Broadcast raw hex directly to Electrum
        const electrumClient = await ElectrumClient.initClientFromUrl(
          currentConfig.server.url,
          selectedNetwork
        )
        await electrumClient.broadcastTransactionHex(signedTx)
        electrumClient.close()
        broadcasted = true
      } else if (psbt) {
        broadcasted = await broadcastTransaction(psbt, blockchain)
      }

      if (broadcasted) {
        setBroadcasted(true)
        router.navigate(`/account/${id}/signAndSend/messageConfirmation`)
      }
    } catch (err) {
      toast(String(err))
    } finally {
      setBroadcasting(false)
    }
  }

  useEffect(() => {
    async function signTransactionMessage() {
      if (signedTx) {
        setSigned(true)
        setRawTx(signedTx)
        return
      }

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
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
        }}
      />
      <SSMainLayout style={{ paddingTop: 0, paddingBottom: 20 }}>
        <ScrollView>
          <SSVStack itemsCenter justifyBetween style={{ minHeight: '100%' }}>
            <SSVStack itemsCenter>
              <SSText size="lg" weight="bold">
                {tn(signed ? 'signed' : 'signing')}
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
                {rawTx !== '' && <SSTransactionDecoded txHex={rawTx} />}
              </SSVStack>
            </SSVStack>

            <SSButton
              variant="secondary"
              label={t('send.broadcast')}
              disabled={!signed || (!psbt && !signedTx)}
              loading={broadcasting}
              onPress={() => handleBroadcastTransaction()}
            />
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </>
  )
}
