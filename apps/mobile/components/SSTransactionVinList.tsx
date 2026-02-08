import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSScriptDecoded from '@/components/SSScriptDecoded'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type Transaction } from '@/types/models/Transaction'

import SSSeparator from './SSSeparator'

type SSTransactionVinListProps = {
  tx?: Transaction
}

export default function SSTransactionVinList({
  tx
}: SSTransactionVinListProps) {
  return (
    <SSVStack>
      {(tx?.vin || []).map((vin, index) => (
        <SSVStack key={index}>
          <SSSeparator color="gradient" />
          <SSText weight="bold" center>
            {t('transaction.input.title')} {index}
          </SSText>
          <SSVStack gap="none">
            <SSText weight="bold">
              {t('transaction.input.previousOutput.transaction')}
            </SSText>
            <SSClipboardCopy text={vin.previousOutput.txid}>
              <SSText color="muted">{vin.previousOutput.txid}</SSText>
            </SSClipboardCopy>
          </SSVStack>
          <SSVStack gap="none">
            <SSText weight="bold">
              {t('transaction.input.previousOutput.vout')}
            </SSText>
            <SSText color="muted">{vin.previousOutput.vout}</SSText>
          </SSVStack>
          <SSVStack gap="none">
            <SSText weight="bold">{t('transaction.input.sequence')}</SSText>
            <SSText color="muted">{vin.sequence}</SSText>
          </SSVStack>
          <SSVStack>
            <SSText weight="bold">{t('transaction.input.scriptSig')}</SSText>
            <SSScriptDecoded script={vin.scriptSig || []} />
          </SSVStack>
        </SSVStack>
      ))}
    </SSVStack>
  )
}
