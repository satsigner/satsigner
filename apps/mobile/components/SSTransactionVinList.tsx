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
        <SSVStack key={index} style={{ paddingTop: 50 }}>
          <SSSeparator color="gradient" />
          <SSText size="lg">
            {t('transaction.input.title')} {index}
          </SSText>
          <SSVStack gap="none">
            <SSText color="muted">
              {t('transaction.input.previousOutput.transaction')}
            </SSText>
            <SSClipboardCopy text={input.previousOutput.txid}>
              <SSText type="mono" size="md">
                {input.previousOutput.txid}
              </SSText>
            </SSClipboardCopy>
          </SSVStack>
          <SSVStack gap="none">
            <SSText color="muted">
              {t('transaction.input.previousOutput.vout')}
            </SSText>
            <SSText size="lg">{input.previousOutput.vout}</SSText>
          </SSVStack>
          <SSVStack gap="none">
            <SSText color="muted">{t('transaction.input.sequence')}</SSText>
            <SSText size="lg">{input.sequence}</SSText>
          </SSVStack>
          <SSVStack>
            <SSText color="muted">{t('transaction.input.scriptSig')}</SSText>
            <SSScriptDecoded script={input.scriptSig || []} />
          </SSVStack>
        </SSVStack>
      ))}
    </SSVStack>
  )
}
