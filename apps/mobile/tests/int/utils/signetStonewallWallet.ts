import ecc from '@bitcoinerlab/secp256k1'
import { BIP32Factory } from 'bip32'
import { payments, networks } from 'bitcoinjs-lib'

import Esplora from '@/api/esplora'
import { type Address } from '@/types/models/Address'
import { type Utxo } from '@/types/models/Utxo'
import { getExtendedKeyFromDescriptor } from '@/utils/bip32'

/** Esplora endpoint; matches SatSigner Signet default (mempool.space). */
const SIGNET_ESPLORA_URL = 'https://mempool.space/signet/api'

const SIGNET_STONEWALL_DESCRIPTOR =
  'wpkh([60c6c741/84h/1h/0h]tpubDDSsu3cncmRPe7hd3TYa419HMeHkdhGKNmUA17dDfyUogBE5pRKDPV14reDahCasFuJK9Zrnb9NXchBXCjhzgxRJgd5XHrVumiiqaTSwedx/<0;1>/*)#xgd2rmj0'

const SIGNET_STONEWALL_RECIPIENT = 'tb1qka4utqxjj8g9az433nv0nnkfxsa9l9y0zfjvuj'

const SIGNET_STONEWALL_AMOUNT = 4687

/** Sparrow used ~1 sat/vB for this send (UI showed 678 sats fee). */
const SIGNET_STONEWALL_FEE_RATE = 1

/** Scan range for esplora (150 covers most catalog UTXOs; Sparrow may scan to 230). */
const MAX_SCAN_INDEX = 150

const bip32 = BIP32Factory(ecc)

type ScannedUtxo = Utxo & {
  addressIndex: number
}

type SignetStonewallWalletSnapshot = {
  addresses: Address[]
  amount: number
  descriptor: string
  feeRate: number
  recipient: string
  utxos: ScannedUtxo[]
}

function deriveP2wpkhAddress(
  accountKey: ReturnType<typeof bip32.fromBase58>,
  chain: number,
  index: number
) {
  const node = accountKey.derive(chain).derive(index)
  const pubkey = Buffer.from(node.publicKey)
  return payments.p2wpkh({ network: networks.testnet, pubkey }).address!
}

async function fetchWalletSnapshot(
  esploraUrl = SIGNET_ESPLORA_URL,
  maxIndex = MAX_SCAN_INDEX
): Promise<SignetStonewallWalletSnapshot> {
  const esplora = new Esplora(esploraUrl)
  const tpub = getExtendedKeyFromDescriptor(SIGNET_STONEWALL_DESCRIPTOR)
  const accountKey = bip32.fromBase58(tpub, networks.testnet)

  const addresses: Address[] = []
  const utxos: ScannedUtxo[] = []

  for (const chain of [0, 1] as const) {
    const keychain = chain === 0 ? 'external' : 'internal'

    for (let index = 0; index <= maxIndex; index += 1) {
      const address = deriveP2wpkhAddress(accountKey, chain, index)
      addresses.push({
        address,
        index,
        keychain,
        label: '',
        summary: {
          balance: 0,
          satsInMempool: 0,
          transactions: 0,
          utxos: 0
        },
        transactions: [],
        utxos: []
      })

      const addressUtxos = await esplora.getAddressUtxos(address)
      for (const utxo of addressUtxos) {
        utxos.push({
          addressIndex: index,
          addressTo: address,
          keychain,
          label: '',
          txid: utxo.txid,
          value: utxo.value,
          vout: utxo.vout
        })
      }
    }
  }

  return {
    addresses,
    amount: SIGNET_STONEWALL_AMOUNT,
    descriptor: SIGNET_STONEWALL_DESCRIPTOR,
    feeRate: SIGNET_STONEWALL_FEE_RATE,
    recipient: SIGNET_STONEWALL_RECIPIENT,
    utxos
  }
}

export {
  fetchWalletSnapshot,
  SIGNET_ESPLORA_URL,
  SIGNET_STONEWALL_AMOUNT,
  SIGNET_STONEWALL_DESCRIPTOR,
  SIGNET_STONEWALL_FEE_RATE,
  SIGNET_STONEWALL_RECIPIENT
}
export type { ScannedUtxo, SignetStonewallWalletSnapshot }
