import SSHStack from '@/layouts/SSHStack'
import { t } from '@/locales'

import SSText, { type SSTextProps } from './SSText'

type SSFeeReplacementFlagsProps = {
  cpfp: boolean
  rbf: boolean
  size?: SSTextProps['size']
}

function SSFeeReplacementFlags({
  cpfp,
  rbf,
  size
}: SSFeeReplacementFlagsProps) {
  if (!rbf && !cpfp) {
    return null
  }
  return (
    <SSHStack gap="sm">
      {rbf ? (
        <SSText uppercase color="muted" size={size}>
          {t('transaction.feeReplacement.flag.rbf')}
        </SSText>
      ) : null}
      {cpfp ? (
        <SSText uppercase color="muted" size={size}>
          {t('transaction.feeReplacement.flag.cpfp')}
        </SSText>
      ) : null}
    </SSHStack>
  )
}

export default SSFeeReplacementFlags
