import React from 'react'

import SSText from '@/components/SSText'

type SSConsoleOutputProps = {
  generating: boolean
  consoleTxt: string[]
} & React.ComponentPropsWithoutRef<typeof SSText>

export default function SSConsoleOutput({
  generating,
  style,
  consoleTxt
}: SSConsoleOutputProps) {
  if (generating) {
    return <SSText style={style}>generating...</SSText>
  } else {
    return <SSText style={style}>{consoleTxt.join('\n')}</SSText>
  }
}
