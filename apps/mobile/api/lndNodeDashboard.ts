import { LND_REST } from '@/constants/lightningLnd'
import {
  type LndBlockchainBalanceResponse,
  type LndChannelBalanceResponse,
  type LndCombinedTransaction,
  type LndInvoice,
  type LndNodeDashboardData,
  type LndOnchainTransaction,
  type LndPayment,
  type LndProcessedBalance
} from '@/types/lndNodeDashboard'
import { type LNDChannel, type LNDRequest } from '@/types/models/LND'
import {
  decodeLightningInvoice,
  isLightningInvoice
} from '@/utils/lightningInvoiceDecoder'
import { mergeCombinedTransactions } from '@/utils/lndNodeDashboard'

export type LndNodeDashboardCopy = {
  defaultInvoiceDescription: string
}

export type LndNodeDashboardFetchers = {
  getBalance: () => Promise<LndBlockchainBalanceResponse>
  getChannels: () => Promise<LNDChannel[]>
  makeRequest: LNDRequest
}

function parseProcessedBalance(
  blockchainBalance: LndBlockchainBalanceResponse,
  channelBalance: LndChannelBalanceResponse
): LndProcessedBalance {
  const totalBalance = Number(blockchainBalance?.total_balance || 0)
  const onchainBalance = Number(blockchainBalance?.confirmed_balance || 0)
  const channelBalanceValue = Number(channelBalance?.local_balance?.sat || 0)

  return {
    channel_balance: Number.isNaN(channelBalanceValue)
      ? 0
      : channelBalanceValue,
    onchain_balance: Number.isNaN(onchainBalance) ? 0 : onchainBalance,
    total_balance: Number.isNaN(totalBalance) ? 0 : totalBalance
  }
}

function mapOnchainTransactions(
  transactions: LndOnchainTransaction[]
): LndCombinedTransaction[] {
  return transactions.map((tx) => ({
    amount: Number(tx.amount),
    hash: tx.tx_hash,
    id: tx.tx_hash,
    num_confirmations: tx.num_confirmations,
    status: tx.num_confirmations > 0 ? 'confirmed' : 'pending',
    timestamp: Number(tx.time_stamp),
    type: 'onchain' as const
  }))
}

function descriptionFromLndPayment(payment: LndPayment): string | undefined {
  const memo = typeof payment.memo === 'string' ? payment.memo.trim() : ''
  if (memo) {
    return memo
  }
  const prRaw = payment.payment_request?.trim() ?? ''
  const pr = prRaw.replace(/^lightning:/i, '')
  if (!pr) {
    return undefined
  }
  const urlDesc = pr.match(/[?&]d=([^&]+)/)
  if (urlDesc?.[1]) {
    try {
      const decodedUrl = decodeURIComponent(urlDesc[1]).trim()
      if (decodedUrl) {
        return decodedUrl
      }
    } catch {
      /* ignore */
    }
  }
  if (isLightningInvoice(pr)) {
    try {
      const decoded = decodeLightningInvoice(pr)
      const fromBolt = (decoded.description || '').trim()
      if (fromBolt) {
        return fromBolt
      }
    } catch {
      /* ignore */
    }
  }
  return undefined
}

function mapPayments(payments: LndPayment[]): LndCombinedTransaction[] {
  return payments.map((payment) => ({
    amount: -Number(payment.value_sat),
    description: descriptionFromLndPayment(payment),
    fee: Number(payment.fee_sat),
    hash: payment.payment_hash,
    id: payment.payment_hash,
    status: payment.status,
    timestamp: Number(payment.creation_date),
    type: 'lightning_send' as const
  }))
}

function mapInvoices(
  invoices: LndInvoice[],
  includeOpenInvoices: boolean,
  defaultDescription: string
): LndCombinedTransaction[] {
  return invoices
    .map((invoice) => ({
      amount: Number(
        invoice.state === 'SETTLED'
          ? invoice.amt_paid_sat || invoice.payment_sat || invoice.value || 0
          : invoice.value || 0
      ),
      description: invoice.description || invoice.memo || defaultDescription,
      expiry: invoice.expiry ? Number(invoice.expiry) : undefined,
      hash: invoice.r_hash,
      id: invoice.r_hash,
      originalAmount: invoice.value ? Number(invoice.value) : 0,
      status: invoice.state.toLowerCase(),
      timestamp: Number(
        invoice.state === 'SETTLED' && invoice.settle_date !== '0'
          ? invoice.settle_date
          : invoice.creation_date
      ),
      type: 'lightning_receive' as const
    }))
    .filter((row) => includeOpenInvoices || row.status !== 'open')
}

export async function fetchLndNodeDashboard(
  fetchers: LndNodeDashboardFetchers,
  includeOpenInvoices: boolean,
  copy: LndNodeDashboardCopy
): Promise<LndNodeDashboardData> {
  const { getBalance, getChannels, makeRequest } = fetchers

  const [
    blockchainBalance,
    channelBalance,
    ,
    onchainRes,
    paymentsRes,
    invoicesRes
  ] = await Promise.all([
    getBalance(),
    makeRequest<LndChannelBalanceResponse>(LND_REST.BALANCE_CHANNELS),
    getChannels(),
    makeRequest<{ transactions: LndOnchainTransaction[] }>(
      LND_REST.TRANSACTIONS
    ),
    makeRequest<{ payments: LndPayment[] }>(LND_REST.PAYMENTS),
    makeRequest<{ invoices: LndInvoice[] }>(LND_REST.INVOICES)
  ])

  const balance = parseProcessedBalance(blockchainBalance, channelBalance)

  const rawInvoiceList = invoicesRes.invoices ?? []
  const rawPaymentList = paymentsRes.payments ?? []
  const rawOnchainList = onchainRes.transactions ?? []

  const onchainTxs = mapOnchainTransactions(rawOnchainList)
  const paymentTxs = mapPayments(rawPaymentList)
  const invoiceTxs = mapInvoices(
    rawInvoiceList,
    includeOpenInvoices,
    copy.defaultInvoiceDescription
  )

  const allTxs = [...onchainTxs, ...paymentTxs, ...invoiceTxs]
  const transactions = mergeCombinedTransactions(allTxs)

  const rawInvoices: Record<string, LndInvoice> = Object.fromEntries(
    rawInvoiceList.map((i) => [i.r_hash, i])
  )
  const rawPayments: Record<string, LndPayment> = Object.fromEntries(
    rawPaymentList.map((p) => [p.payment_hash, p])
  )
  const rawOnchainTxs: Record<string, LndOnchainTransaction> =
    Object.fromEntries(rawOnchainList.map((t) => [t.tx_hash, t]))

  return { balance, rawInvoices, rawOnchainTxs, rawPayments, transactions }
}
