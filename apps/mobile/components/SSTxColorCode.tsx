import SSVStack from "@/layouts/SSVStack"
import SSText from "./SSText"
import { TxDecoded } from "@/utils/coloredTx"

type SSTxColorCodeProps = {
   rawTxHex: string
}

export default function SSTxColorCode({
   rawTxHex
}: SSTxColorCodeProps) {

   const tx = TxDecoded.fromHex(rawTxHex)
   console.log(tx.toAnnotatedData())

  return (
     <SSVStack>
         <SSText type="mono">
            {rawTxHex}
         </SSText>
     </SSVStack>
  )
}
