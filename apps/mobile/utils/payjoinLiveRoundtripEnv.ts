import { KeychainKind, Psbt } from 'react-native-bdk-sdk'
import { isNativeAvailable } from 'react-native-payjoin'

import {
  broadcastTransaction,
  buildPsbt,
  getWalletData,
  signTransaction
} from '@/api/bdk'
import Esplora from '@/api/esplora'
import {
  PAYJOIN_LIVE_ROUNDTRIP_FEE_SATS,
  PAYJOIN_LIVE_ROUNDTRIP_PAYMENT_SATS,
  PAYJOIN_MIN_CONTRIBUTE_SATS
} from '@/constants/payjoin'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { usePayjoinSessionsStore } from '@/store/payjoinSessions'
import { type Account } from '@/types/models/Account'
import { type Utxo } from '@/types/models/Utxo'
import { getAccountWithDecryptedKeys } from '@/utils/account'
import { appNetworkToBdkNetwork, bitcoinjsNetwork } from '@/utils/bitcoin'
import { type PayjoinRoundtripEnv } from '@/utils/payjoinLiveRoundtrip'
import {
  findClownAccount,
  findSampleAccount
} from '@/utils/payjoinLiveRoundtripAccounts'
import { preparePayjoinPsbtForWalletSign } from '@/utils/payjoinSign'
import {
  filterPayjoinContributeUtxos,
  isConfirmedUtxo
} from '@/utils/payjoinUtxos'
import { buildPayjoinWalletCallbacks } from '@/utils/payjoinWallet'

function pickFundingUtxo(
  utxos: Utxo[],
  transactions: Account['transactions'],
  needSats: number
): Utxo | undefined {
  const confirmed = utxos
    .filter((utxo) => isConfirmedUtxo(utxo, transactions))
    .toSorted((a, b) => b.value - a.value)
  return confirmed.find((utxo) => utxo.value >= needSats)
}

async function loadAccountWallet(account: Account) {
  const decrypted = await getAccountWithDecryptedKeys(account)
  const walletData = await getWalletData(
    decrypted,
    appNetworkToBdkNetwork(account.network)
  )
  if (!walletData) {
    throw new Error(`failed to load wallet for ${account.name}`)
  }
  return walletData.wallet
}

/**
 * Resolve Sample (sender) + Clown (receiver) from the vault and wire BDK
 * build/sign/broadcast for `runPayjoinLiveRoundtrip`.
 */
async function buildPayjoinLiveRoundtripEnv(): Promise<PayjoinRoundtripEnv> {
  if (!isNativeAvailable()) {
    throw new Error(t('settings.developer.diagnosis.error.nativeUnavailable'))
  }

  const { selectedNetwork, configs } = useBlockchainStore.getState()
  if (selectedNetwork === 'bitcoin') {
    throw new Error(t('settings.developer.diagnosis.error.mainnet'))
  }
  if (selectedNetwork !== 'signet') {
    throw new Error(t('settings.developer.diagnosis.error.wrongNetwork'))
  }

  const { accounts } = useAccountsStore.getState()
  const maybeSender = findSampleAccount(accounts)
  const maybeReceiver = findClownAccount(accounts)
  if (!maybeSender || !maybeReceiver) {
    throw new Error(t('settings.developer.diagnosis.error.missingAccounts'))
  }
  const sender: Account = maybeSender
  const receiver: Account = maybeReceiver

  const receiverContribute = filterPayjoinContributeUtxos(
    receiver.utxos,
    receiver.transactions ?? []
  )
  if (receiverContribute.length === 0) {
    throw new Error(
      t('settings.developer.diagnosis.error.insufficientReceiverFunds', {
        minSats: PAYJOIN_MIN_CONTRIBUTE_SATS
      })
    )
  }

  const paymentAmountSats = PAYJOIN_LIVE_ROUNDTRIP_PAYMENT_SATS
  const feeSats = PAYJOIN_LIVE_ROUNDTRIP_FEE_SATS
  const fundingNeed = paymentAmountSats + feeSats + 546
  const maybeFunding = pickFundingUtxo(
    sender.utxos,
    sender.transactions ?? [],
    fundingNeed
  )
  if (!maybeFunding) {
    throw new Error(
      t('settings.developer.diagnosis.error.insufficientSenderFunds', {
        needSats: fundingNeed
      })
    )
  }
  const fundingUtxo: Utxo = maybeFunding

  const [senderWallet, receiverWallet] = await Promise.all([
    loadAccountWallet(sender),
    loadAccountWallet(receiver)
  ])

  const receiverAddress =
    receiver.addresses?.find((a) => a.address)?.address ??
    receiverWallet.peekAddress(KeychainKind.External, 0).address
  if (!receiverAddress) {
    throw new Error(t('settings.developer.diagnosis.error.missingAccounts'))
  }

  const changeAddress = senderWallet.peekAddress(
    KeychainKind.Internal,
    0
  ).address
  const { server } = configs[selectedNetwork]
  const sessions = usePayjoinSessionsStore.getState()
  const network = bitcoinjsNetwork(selectedNetwork)

  function buildSenderCallbacks() {
    return buildPayjoinWalletCallbacks({
      hasSeenInput: (outpoint) => sessions.hasSeenInput(outpoint),
      markInputSeen: (outpoint) => sessions.markInputSeen(outpoint),
      network,
      ownedAddresses: (sender.addresses ?? []).map((a) => a.address),
      signPsbt: (proposalBase64) => {
        const prepared = preparePayjoinPsbtForWalletSign({
          getPrevTxHex: (txid) => senderWallet.getTx(txid),
          psbtBase64: proposalBase64,
          utxos: sender.utxos
        })
        const proposal = new Psbt(prepared)
        signTransaction(proposal, senderWallet)
        return proposal.toBase64()
      },
      transactions: sender.transactions ?? [],
      utxos: sender.utxos
    })
  }

  function buildReceiverCallbacks() {
    return buildPayjoinWalletCallbacks({
      hasSeenInput: (outpoint) => sessions.hasSeenInput(outpoint),
      markInputSeen: (outpoint) => sessions.markInputSeen(outpoint),
      network,
      ownedAddresses: [
        receiverAddress,
        ...(receiver.addresses ?? []).map((a) => a.address)
      ],
      signPsbt: (proposalBase64) => {
        const prepared = preparePayjoinPsbtForWalletSign({
          getPrevTxHex: (txid) => receiverWallet.getTx(txid),
          psbtBase64: proposalBase64,
          utxos: receiver.utxos
        })
        const proposal = new Psbt(prepared)
        signTransaction(proposal, receiverWallet)
        return proposal.toBase64()
      },
      transactions: receiver.transactions ?? [],
      utxos: receiver.utxos
    })
  }

  async function buildAndSignOriginal(
    toAddress: string,
    amountSats: number
  ): Promise<string> {
    const changeSats = fundingUtxo.value - amountSats - feeSats
    if (changeSats < 546) {
      throw new Error(
        t('settings.developer.diagnosis.error.insufficientSenderFunds', {
          needSats: fundingNeed
        })
      )
    }
    const psbt = await buildPsbt(senderWallet, server, sender, {
      fee: feeSats,
      inputs: [fundingUtxo],
      options: { rbf: false },
      outputs: [
        {
          amount: amountSats,
          label: '',
          localId: 'payjoin-roundtrip-payment',
          to: toAddress
        },
        {
          amount: changeSats,
          kind: 'change',
          label: '',
          localId: 'payjoin-roundtrip-change',
          to: changeAddress
        }
      ]
    })
    // Match the send UI: post the built original (witness UTXO filled) without
    // finalizing sender inputs — PDK rejects finalized originals.
    return psbt.toBase64()
  }

  async function broadcast(payjoinPsbtBase64: string): Promise<string> {
    const psbt = new Psbt(payjoinPsbtBase64)
    if (server.backend === 'esplora') {
      const hex = psbt.extractTxHex()
      const esplora = new Esplora(server.url)
      await esplora.broadcastTransaction(hex)
      return psbt.txid()
    }
    return broadcastTransaction(
      senderWallet,
      psbt,
      server.backend,
      server.url,
      server.rpcCredentials
    )
  }

  return {
    broadcast,
    buildAndSignOriginal,
    network: selectedNetwork,
    paymentAmountSats,
    receiverAccountId: receiver.id,
    receiverAddress,
    receiverCallbacks: buildReceiverCallbacks(),
    senderAccountId: sender.id,
    senderCallbacks: buildSenderCallbacks()
  }
}

export { buildPayjoinLiveRoundtripEnv }
