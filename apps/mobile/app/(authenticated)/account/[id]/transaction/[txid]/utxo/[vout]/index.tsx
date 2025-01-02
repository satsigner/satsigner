import { MempoolOracle } from '@/api/blockchain'
import SSButton from '@/components/SSButton'
import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSSeparator from '@/components/SSSeparator'
import SSTagInput from '@/components/SSTagInput'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'
import { i18n } from '@/locales'
import { useBlockchainStore } from '@/store/blockchain'
import { type Tx } from '@/types/models/Blockchain'
import { formatDate } from '@/utils/format'
import { useRoute } from '@react-navigation/native'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

function UtxoDetails() {
  const route = useRoute()
  const { params } = route as any
  const { txid, vout } = params
  const [tx, setTx] = useState(null as unknown as Tx)

  const [url] = useBlockchainStore(useShallow((state) => [state.url]))

  const oracle = new MempoolOracle(url)

  useEffect(() => {
    oracle.getTransaction(txid).then(setTx)
  }, [txid])

  const tags = [
    'kyc',
    'kyc-free',
    'aa1',
    'aa2',
    'aa3',
    'aa4',
    'aa5',
    'aa6',
    'aa7',
    'aa8',
    'aa9',
    'aa10',
    'aa11',
    'friends',
    'shopping',
    'exchange'
  ]
  const [selectedTags, setSelectedTags] = useState([] as string[])

  return (
    <ScrollView>
      <SSVStack
        gap="xl"
        style={{
          flexGrow: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 20
        }}
      >
        {tx && (
          <>
            <SSVStack>
              <SSText center size="lg">
                UTXO Details
              </SSText>

              <SSText weight="bold">LABEL</SSText>
              <SSTextInput
                align="left"
                multiline={true}
                numberOfLines={3}
                style={{
                  height: 'auto',
                  textAlignVertical: 'top',
                  padding: 10
                }}
              />

              <SSText weight="bold">TAGS</SSText>
              <SSTagInput
                tags={tags}
                selectedTags={selectedTags}
                onSelect={setSelectedTags}
              ></SSTagInput>
            </SSVStack>

            <SSVStack>
              <SSSeparator color="gradient" />

              <SSHStack justifyBetween>
                <SSVStack gap="none">
                  <SSText weight="bold" size="md">
                    DATE
                  </SSText>
                  <SSText color="muted" uppercase>
                    {formatDate(tx.status.block_time)}
                  </SSText>
                </SSVStack>
                <SSVStack gap="none">
                  <SSText weight="bold" size="md">
                    BLOCK
                  </SSText>
                  <SSText color="muted" uppercase>
                    {tx.status.block_height}
                  </SSText>
                </SSVStack>
                <SSVStack gap="none">
                  <SSText weight="bold" size="md">
                    AMOUNT
                  </SSText>
                  <SSClipboardCopy text={tx.size}>
                    <SSText color="muted" uppercase>
                      {tx.size} BYTES
                    </SSText>
                  </SSClipboardCopy>
                </SSVStack>
              </SSHStack>

              <SSSeparator color="gradient" />

              <SSClipboardCopy text={tx.vout[vout].scriptpubkey_address || ''}>
                <SSVStack gap="none">
                  <SSText weight="bold" size="md">
                    ADDRESS
                  </SSText>
                  <SSText color="muted">
                    {tx.vout[vout].scriptpubkey_address}
                  </SSText>
                </SSVStack>
              </SSClipboardCopy>

              <SSSeparator color="gradient" />

              <SSClipboardCopy text={txid}>
                <SSVStack gap="none">
                  <SSText weight="bold" size="md">
                    TRANSACTION
                  </SSText>
                  <SSText color="muted">{txid}</SSText>
                </SSVStack>
              </SSClipboardCopy>

              <SSSeparator color="gradient" />

              <SSClipboardCopy text={vout}>
                <SSVStack gap="none">
                  <SSText weight="bold" size="md">
                    OUTPUT INDEX
                  </SSText>
                  <SSText color="muted">{vout}</SSText>
                </SSVStack>
              </SSClipboardCopy>
            </SSVStack>

            <SSButton label={i18n.t('common.save')} variant="secondary" />
          </>
        )}
      </SSVStack>
    </ScrollView>
  )
}

export default UtxoDetails
