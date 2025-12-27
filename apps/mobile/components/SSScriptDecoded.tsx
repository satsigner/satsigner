import * as bitcoinjs from 'bitcoinjs-lib'

import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { OP_CODE_WORD } from '@/types/logic/opcode'
import { getOpcodeDetails, getOpcodeWord } from '@/utils/scripts'

import SSText from './SSText'

type SSScriptDecodedProps = {
  script: number[]
}

function SSScriptDecoded({ script }: SSScriptDecodedProps) {
  let decodedScript: string | undefined

  try {
    decodedScript = bitcoinjs.script.toASM(Buffer.from(script))
  } catch {
    return <SSText>{t('transaction.decoded.error')}</SSText>
  }

  if (!decodedScript) {
    return <SSText>{t('transaction.decoded.empty')}</SSText>
  }

  return (
    <SSVStack>
      {decodedScript.split(' ').map((item, index) => {
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
              <SSText type="mono" uppercase>
                {item}
              </SSText>
            )}
            <SSText>
              <SSText size="xs" weight="bold">
                {t('common.description')}:{' '}
              </SSText>
              <SSText size="xs" color="muted">
                {t(`opcode.${opcodeWord}`)}
              </SSText>
            </SSText>
          </SSVStack>
        )
      })}
    </SSVStack>
  )
}

export default SSScriptDecoded
