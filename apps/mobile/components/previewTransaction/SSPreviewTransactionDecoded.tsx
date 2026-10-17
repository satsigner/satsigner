import SSText from '@/components/SSText'
import SSTransactionDecoded from '@/components/SSTransactionDecoded'
import SSVStack from '@/layouts/SSVStack'
import { tn as _tn } from '@/locales'

const tn = _tn('transaction.build.preview')

type SSPreviewTransactionDecodedProps = {
  transactionHex: string
}

function SSPreviewTransactionDecoded({
  transactionHex
}: SSPreviewTransactionDecodedProps) {
  return (
    <SSVStack gap="xxs">
      <SSText uppercase size="sm" color="muted">
        {tn('decoded')}
      </SSText>
      {transactionHex !== '' && <SSTransactionDecoded txHex={transactionHex} />}
    </SSVStack>
  )
}

export default SSPreviewTransactionDecoded
