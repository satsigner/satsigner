import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSScriptDecoded from '@/components/SSScriptDecoded'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { type Transaction } from '@/types/models/Transaction'
import { SAFE_LIMIT_OF_INPUTS_OUTPUTS } from '@/types/ui/sankey'

import { withPerformanceWarning } from './SSPerformanceWarning'
import SSSeparator from './SSSeparator'

type SSTransactionVinListProps = {
  vin?: Transaction['vin']
}

export function SSTransactionVinList({ vin }: SSTransactionVinListProps) {
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

const thresholdCheck = ({ vin }: SSTransactionVinListProps) =>
  vin !== undefined && vin.length > SAFE_LIMIT_OF_INPUTS_OUTPUTS

export default withPerformanceWarning<SSTransactionVinListProps>(
  SSTransactionVinList,
  thresholdCheck,
  'Too many transaction inputs.\nDisplaying it may freeze the app.'
)
