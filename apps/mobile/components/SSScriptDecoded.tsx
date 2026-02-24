import * as bitcoinjs from 'bitcoinjs-lib'
import { useState } from 'react'

import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { OP_CODE_WORD } from '@/types/logic/opcode'
import { getOpcodeDetails, getOpcodeWord } from '@/utils/scripts'

import { SSIconWarning } from './icons'
import SSButton from './SSButton'
import SSText from './SSText'

type SSScriptDecodedProps = {
  script: number[] | string
}

const SAFE_SCRIPT_SIZE = 512

function SSScriptDecoded({ script }: SSScriptDecodedProps) {
  const [forceDecodeScript, setForceDecodeScript] = useState(false)
  let decodedScript: string | undefined

  if (
    Array.isArray(script) &&
    Buffer.from(script).byteLength > SAFE_SCRIPT_SIZE &&
    !forceDecodeScript
  ) {
    return (
      <SSVStack>
        <SSIconWarning height={16} width={16} />
        <SSText>
          Script is too big. Trying to decode it may freeze the app.
        </SSText>
        <SSButton
          label="Proceed anyway"
          onPress={() => setForceDecodeScript(true)}
        />
      </SSVStack>
    )
  }

  try {
    if (typeof script === 'string') decodedScript = script
    else decodedScript = bitcoinjs.script.toASM(Buffer.from(script))
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
            <SSText size="xs" color="muted">
              {t(`opcode.${opcodeWord}`)}
            </SSText>
          </SSVStack>
        )
      })}
    </SSVStack>
  )
}

export default SSScriptDecoded
