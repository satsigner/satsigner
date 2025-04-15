import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { ScrollView } from 'react-native-gesture-handler'
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
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { useWalletsStore } from '@/store/wallets'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress } from '@/utils/format'
import { bytesToHex } from '@/utils/scripts'

export default function SignMessage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [txBuilderResult, psbt, setPsbt] = useTransactionBuilderStore(
    useShallow((state) => [state.txBuilderResult, state.psbt, state.setPsbt])
  )
  const account = useAccountsStore(
    useShallow((state) => state.accounts.find((account) => account.id === id))
  )
  const wallet = useWalletsStore((state) => state.wallets[id!])
  const [backend, retries, stopGap, timeout, url] = useBlockchainStore(
    useShallow((state) => {
      const { server, param } = state.configs[state.selectedNetwork]
      return [
        server.backend,
        param.retries,
        param.stopGap,
        param.timeout,
        server.url
      ]
    })
  )

  const [signed, setSigned] = useState(false)
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcasted, setBroadcasted] = useState(false)

  const [rawTx, setRawTx] = useState('')

  async function handleBroadcastTransaction() {
    if (!psbt) return
    setBroadcasting(true)

    const opts = { retries, stopGap, timeout }
    const blockchainConfig = getBlockchainConfig(backend, url, opts)
    const blockchain = await getBlockchain(backend, blockchainConfig)

    try {
      const broadcasted = await broadcastTransaction(psbt, blockchain)

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
        <SSVStack itemsCenter justifyBetween>
          <SSVStack itemsCenter>
            <SSText size="lg" weight="bold">
              {signed ? 'Message Signed' : 'Signing Message'}
            </SSText>
            <SSText color="muted" size="sm" weight="bold" uppercase>
              Message Id
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
          <ScrollView>
            <SSVStack>
              <SSVStack gap="xxs">
                <SSText color="muted" size="sm" uppercase>
                  Message Id
                </SSText>
                <SSText size="lg">{txBuilderResult.txDetails.txid}</SSText>
              </SSVStack>

              <SSVStack gap="xxs">
                <SSText color="muted" size="sm" uppercase>
                  Message
                </SSText>
                {rawTx !== '' && <SSTransactionDecoded txHex={rawTx} />}
              </SSVStack>
            </SSVStack>
          </ScrollView>
          <SSButton
            variant="secondary"
            label={t('send.broadcast')}
            disabled={!signed || !psbt}
            loading={broadcasting}
            onPress={() => handleBroadcastTransaction()}
          />
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
