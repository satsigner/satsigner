import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import {
  getOpcodeDetails,
  getOpcodeWord,
  OP_CODE_WORD
} from '@/types/logic/opcode'

import SSText from './SSText'

type SSScriptDecodedProps = {
  script: string
}

export default function SSScriptDecoded({ script }: SSScriptDecodedProps) {
  return (
    <SSVStack>
      {script.split(' ').map((item, index) => {
        const opcodeWord = getOpcodeWord(item)
        const opcodeDetails = getOpcodeDetails(item)
        return (
          <SSVStack key={index} gap="none">
            {opcodeDetails.word !== OP_CODE_WORD.DATA && (
              <SSText type="mono">
                {opcodeDetails.word} (code={opcodeDetails.code} hex=
                {opcodeDetails.hex})
              </SSText>
            )}
            {opcodeDetails.word === OP_CODE_WORD.DATA && (
              <SSText type="mono">{item}</SSText>
            )}
            <SSText size="xs">
              <SSText size="xs" weight="bold">
                Description:{' '}
              </SSText>
              {i18n.t(`opcode.${opcodeWord}`)}
            </SSText>
          </SSVStack>
        )
      })}
    </SSVStack>
  )
}
