import { useState } from 'react'
import { View } from 'react-native'

import SSIconWarning from '@/components/icons/SSIconWarning'
import SSButton from '@/components/SSButton'
import SSText from '@/components/SSText'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'

type SSPerformanceWarningProps = {
  text: string
  onDismiss: () => void
}

function SSPerformanceWarning({ text, onDismiss }: SSPerformanceWarningProps) {
  return (
    <View
      style={{
        alignContent: 'center',
        flex: 1,
        justifyContent: 'center'
      }}
    >
      <SSVStack itemsCenter style={{ paddingHorizontal: 32 }}>
        <SSVStack gap="none" itemsCenter>
          <SSIconWarning height={32} width={32} />
          <SSText center>{text}</SSText>
        </SSVStack>
        <SSButton
          variant="subtle"
          label={t('common.dismiss')}
          onPress={onDismiss}
        />
      </SSVStack>
    </View>
  )
}

export function withPerformanceWarning<T extends object>(
  Component: React.ComponentType<T>,
  exceedsPerformanceThreshold: (props: T) => boolean,
  warningText = t('common.warningPerformance')
): React.FunctionComponent<T> {
  return (props: T) => {
    const [dismissed, setDismissed] = useState(false)

    // show warning if it exceeds performance threshold and the warning has not been dismissed
    if (!dismissed && exceedsPerformanceThreshold(props)) {
      return (
        <SSPerformanceWarning
          onDismiss={() => setDismissed(true)}
          text={warningText}
        />
      )
    }

    return <Component {...props} />
  }
}

export default SSPerformanceWarning
