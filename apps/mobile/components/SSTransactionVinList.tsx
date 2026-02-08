import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSScriptDecoded from '@/components/SSScriptDecoded'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type Transaction } from '@/types/models/Transaction'

import SSSeparator from './SSSeparator'

type SSTransactionVinListProps = {
  vin?: Transaction['vin']
}

export default function SSTransactionVinList({
  vin
}: SSTransactionVinListProps) {
  return (
    <SSVStack>
      {(vin || []).map((input, index) => (
        <SSVStack key={index}>
          <SSSeparator color="gradient" />
          <SSText weight="bold" center>
            {t('transaction.input.title')} {index}
          </SSText>
          <SSVStack gap="none">
            <SSText weight="bold">
              {t('transaction.input.previousOutput.transaction')}
            </SSText>
            <SSClipboardCopy text={input.previousOutput.txid}>
              <SSText color="muted">{input.previousOutput.txid}</SSText>
            </SSClipboardCopy>
          </SSVStack>
          <SSVStack gap="none">
            <SSText weight="bold">
              {t('transaction.input.previousOutput.vout')}
            </SSText>
            <SSText color="muted">{input.previousOutput.vout}</SSText>
          </SSVStack>
          <SSVStack gap="none">
            <SSText weight="bold">{t('transaction.input.sequence')}</SSText>
            <SSText color="muted">{input.sequence}</SSText>
          </SSVStack>
          <SSVStack>
            <SSText weight="bold">{t('transaction.input.scriptSig')}</SSText>
            <SSScriptDecoded script={input.scriptSig || []} />
          </SSVStack>
        </SSVStack>
      ))}
    </SSVStack>
  )
}
