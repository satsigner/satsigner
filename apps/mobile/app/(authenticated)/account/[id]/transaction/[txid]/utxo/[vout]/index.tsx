import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
import { useShallow } from 'zustand/react/shallow'

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
import { useAccountsStore } from '@/store/accounts'
import { useBlockchainStore } from '@/store/blockchain'
import { type Tx } from '@/types/models/Blockchain'
import type { UtxoSearchParams } from '@/types/navigation/searchParams'
import { formatDate } from '@/utils/format'

export default function UtxoDetails() {
  const { id, txid, vout } = useLocalSearchParams<UtxoSearchParams>()

  const getCurrentAccount = useAccountsStore((state) => state.getCurrentAccount)

  const account = getCurrentAccount(id)!

  const placeholder = '-'
  const [blockTime, setBlockTime] = useState(placeholder)
  const [blockHeight, setBlockHeight] = useState(placeholder)
  const [txSize, setTxSize] = useState(placeholder)
  const [txAddress, setTxAddress] = useState(placeholder)

  const [url] = useBlockchainStore(useShallow((state) => [state.url]))

  const oracle = new MempoolOracle(url)

  useEffect(() => {
    const fetchUtxoInfo = async () => {
      const tx = await oracle.getTransaction(txid)
      setTxSize(tx.size.toString())
      setBlockHeight(tx.status.block_height.toString())
      setBlockTime(formatDate(tx.status.block_time as unknown as Date))
      setTxAddress(tx.vout[Number(vout)].scriptpubkey_address || '-')
    }

    try {
      fetchUtxoInfo()
    } catch {
      // TODO: show error notification via snack bar
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txid])

  const tags = [
    'kyc',
    'kyc-free',
    'aa1',
    'aa2',
    'aa3',
    'aa4',
    'friends',
    'shopping',
    'exchange'
  ]
  const [selectedTags, setSelectedTags] = useState([] as string[])

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText uppercase>{account.name}</SSText>
        }}
      />
      <SSVStack
        gap="xl"
        style={{
          flexGrow: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 20
        }}
      >
        <SSVStack>
          <SSText center size="lg">
            {i18n.t('utxoDetails.title')}
          </SSText>
          <SSText weight="bold" uppercase>
            {i18n.t('common.label')}
          </SSText>
          <SSTextInput
            align="left"
            multiline
            numberOfLines={3}
            style={{
              height: 'auto',
              textAlignVertical: 'top',
              padding: 10
            }}
          />
          <SSText weight="bold" uppercase>
            {i18n.t('common.tags')}
          </SSText>
          <SSTagInput
            tags={tags}
            selectedTags={selectedTags}
            onSelect={setSelectedTags}
          />
        </SSVStack>
        <SSVStack>
          <SSSeparator color="gradient" />
          <SSHStack justifyBetween>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.date')}
              </SSText>
              <SSText color="muted" uppercase>
                {blockTime}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.block')}
              </SSText>
              <SSText color="muted" uppercase>
                {blockHeight}
              </SSText>
            </SSVStack>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.amount')}
              </SSText>
              <SSClipboardCopy text={txSize}>
                <SSText color="muted" uppercase>
                  {txSize}{' '}
                  {txSize !== placeholder ? i18n.t('common.bytes') : ''}
                </SSText>
              </SSClipboardCopy>
            </SSVStack>
          </SSHStack>
          <SSSeparator color="gradient" />
          <SSClipboardCopy text={txAddress}>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.address')}
              </SSText>
              <SSText color="muted">{txAddress}</SSText>
            </SSVStack>
          </SSClipboardCopy>
          <SSSeparator color="gradient" />
          <SSClipboardCopy text={txid}>
            <SSVStack gap="none">
              <SSText weight="bold" uppercase>
                {i18n.t('common.transaction')}
              </SSText>
              <SSText color="muted">{txid}</SSText>
            </SSVStack>
          </SSClipboardCopy>
          <SSSeparator color="gradient" />
          <SSClipboardCopy text={vout}>
            <SSVStack gap="none">
              <SSText weight="bold">
                OUTPUT INDEX
              </SSText>
              <SSText color="muted">{vout}</SSText>
            </SSVStack>
          </SSClipboardCopy>
        </SSVStack>
        <SSButton label={i18n.t('common.save')} variant="secondary" />
      </SSVStack>
    </ScrollView>
  )
}
