import { type Network } from 'bdk-rn/lib/lib/enums'
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'

import {
  broadcastTransaction,
  getBlockchain,
  getWalletFromMnemonic,
  signTransaction
} from '@/api/bdk'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import { getBlockchainConfig } from '@/config/servers'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { useTransactionBuilderStore } from '@/store/transactionBuilder'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { formatAddress } from '@/utils/format'

export default function SignMessage() {
  const router = useRouter()
  const { id } = useLocalSearchParams<AccountSearchParams>()

  const [txBuilderResult, psbt, setPsbt] = useTransactionBuilderStore(
    useShallow((state) => [state.txBuilderResult, state.psbt, state.setPsbt])
  )
  const [account, decryptSeed] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((account) => account.name === id),
      state.decryptSeed
    ])
  )
  const [backend, network, retries, stopGap, timeout, url] = useBlockchainStore(
    useShallow((state) => [
      state.backend,
      state.network,
      state.retries,
      state.stopGap,
      state.timeout,
      state.url
    ])
  )

  const [signed, setSigned] = useState(false)
  const [broadcasting, setBroadcasting] = useState(false)

  async function handleBroadcastTransaction() {
    if (!psbt) return
    setBroadcasting(true)

    const opts = { retries, stopGap, timeout }
    const blockchainConfig = getBlockchainConfig(backend, url, opts)
    const blockchain = await getBlockchain(backend, blockchainConfig)

    try {
      const broadcasted = await broadcastTransaction(psbt, blockchain)

      if (broadcasted)
        router.navigate(`/account/${id}/signAndSend/messageConfirmation`)
    } catch (_err) {
      // TODO: Handle not broadcasted
    } finally {
      setBroadcasting(false)
    }
  }

  useEffect(() => {
    async function signTransactionMessage() {
      const seed = await decryptSeed(id!)

      if (!seed || !account || !account.scriptVersion || !txBuilderResult)
        return

      const result = await getWalletFromMnemonic(
        seed.replace(/,/g, ' '),
        account.scriptVersion,
        account.passphrase,
        network as Network
      )

      const partiallySignedTransaction = await signTransaction(
        txBuilderResult,
        result.wallet
      )

      setSigned(true)
      setPsbt(partiallySignedTransaction)
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
      <SSMainLayout>
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
          </SSVStack>
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
              <SSText size="lg">todo</SSText>
            </SSVStack>
          </SSVStack>
          <SSButton
            variant="secondary"
            label={t('broadcast.transaction')}
            disabled={!signed || !psbt}
            loading={broadcasting}
            onPress={() => handleBroadcastTransaction()}
          />
        </SSVStack>
      </SSMainLayout>
    </>
  )
}
