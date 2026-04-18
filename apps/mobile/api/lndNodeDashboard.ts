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
import { mergeCombinedTransactions } from '@/utils/lndNodeDashboard'

export type LndNodeDashboardCopy = {
  defaultInvoiceDescription: string
  defaultPaymentDescription: string
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

function mapPayments(
  payments: LndPayment[],
  defaultDescription: string
): LndCombinedTransaction[] {
  return payments.map((payment) => {
    let description = defaultDescription
    if (payment.payment_request) {
      const match = payment.payment_request.match(/[?&]d=([^&]+)/)
      if (match?.[1]) {
        try {
          description = decodeURIComponent(match[1])
        } catch {
          // keep default
        }
      }
    }
    return {
      amount: -Number(payment.value_sat),
      description,
      fee: Number(payment.fee_sat),
      hash: payment.payment_hash,
      id: payment.payment_hash,
      status: payment.status,
      timestamp: Number(payment.creation_date),
      type: 'lightning_send' as const
    }
  })
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

  const onchainTxs = mapOnchainTransactions(onchainRes.transactions ?? [])
  const paymentTxs = mapPayments(
    paymentsRes.payments ?? [],
    copy.defaultPaymentDescription
  )
  const invoiceTxs = mapInvoices(
    invoicesRes.invoices ?? [],
    includeOpenInvoices,
    copy.defaultInvoiceDescription
  )

  const allTxs = [...onchainTxs, ...paymentTxs, ...invoiceTxs]
  const transactions = mergeCombinedTransactions(allTxs)

  return { balance, transactions }
}
