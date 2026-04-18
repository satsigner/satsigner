import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { fetchLndNodeDashboard } from '@/api/lndNodeDashboard'
import { useLND } from '@/hooks/useLND'
import { t } from '@/locales'

function useLndNodeDashboard(includeOpenInvoices: boolean) {
  const { getBalance, getChannels, isConnected, makeRequest } = useLND()

  return useQuery({
    enabled: isConnected,
    placeholderData: keepPreviousData,
    queryFn: () =>
      fetchLndNodeDashboard(
        { getBalance, getChannels, makeRequest },
        includeOpenInvoices,
        {
          defaultInvoiceDescription: t('lightning.node.defaultInvoiceMemo'),
          defaultPaymentDescription: t('lightning.node.defaultPaymentMemo')
        }
      ),
    queryKey: ['lnd', 'node-dashboard', includeOpenInvoices]
  })
}

export { useLndNodeDashboard }
