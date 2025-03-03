import { toOutputScript } from 'bitcoinjs-lib/src/address'
import { toASM } from 'bitcoinjs-lib/src/script'
import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSLabelDetails from '@/components/SSLabelDetails'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useAccountsStore } from '@/store/accounts'
import { type AddrSearchParams } from '@/types/navigation/searchParams'
import { bitcoinjsNetwork } from '@/utils/bitcoin'
import { formatNumber } from '@/utils/format'

function AddressDetails() {
  const { id: accountId, addr } = useLocalSearchParams<AddrSearchParams>()
  const [script, setScript] = useState('')

  const [account, address] = useAccountsStore((state) => [
    state.accounts.find((account) => account.name === accountId),
    state.accounts
      .find((account) => account.name === accountId)
      ?.addresses.find((address) => {
        // TODO: remove keychain after fixing the internal address BUG
        return address.address === addr && address.keychain === 'internal'
      })
  ])

  useEffect(() => {
    if (!address) return
    try {
      const rawScript = toOutputScript(
        address.address,
        bitcoinjsNetwork(address.network || 'signet')
      )
      setScript(toASM(rawScript))
    } catch {
      setScript('')
    }
  }, [address])

  if (!account || !addr || !address) {
    return <SSText>NOT FOUND</SSText>
  }

  return (
    <ScrollView>
      <Stack.Screen
        options={{
          headerTitle: () => <SSText>ADDRESS DETAILS</SSText>
        }}
      />
      <SSMainLayout style={{ paddingBottom: 24, paddingTop: 12 }}>
        <ScrollView>
          <SSVStack>
            <SSVStack>
              <SSText weight="bold" uppercase size="md">
                Address
              </SSText>
              <SSAddressDisplay address={addr} />
            </SSVStack>
            <SSSeparator />
            <SSLabelDetails
              label={address.label}
              header="LABEL"
              link={`/account/${accountId}/address/${addr}/label`}
            />
            <SSSeparator />
            <SSVStack gap="sm">
              <SSText uppercase weight="bold" size="md">
                BALANCE
              </SSText>
              <SSHStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    Confirmed
                  </SSText>
                  <SSText>{formatNumber(address.summary.balance)}</SSText>
                </SSVStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    Unconfirmed
                  </SSText>
                  <SSText>{formatNumber(address.summary.satsInMempool)}</SSText>
                </SSVStack>
              </SSHStack>
            </SSVStack>
            <SSSeparator />
            <SSVStack gap="sm">
              <SSText uppercase weight="bold" size="md">
                HISTORY
              </SSText>
              <SSHStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    Total transactions
                  </SSText>
                  <SSText>{address?.summary.transactions}</SSText>
                </SSVStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    Total UTXOs
                  </SSText>
                  <SSText>{address?.summary.utxos}</SSText>
                </SSVStack>
              </SSHStack>
            </SSVStack>
            <SSSeparator />
            <SSVStack gap="sm">
              <SSText uppercase weight="bold" size="md">
                ENCODING
              </SSText>
              <SSHStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    Script version
                  </SSText>
                  <SSText uppercase>{address.scriptVersion || '-'}</SSText>
                </SSVStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    Network
                  </SSText>
                  <SSText uppercase>{address.network || '-'}</SSText>
                </SSVStack>
              </SSHStack>
              <SSVStack gap="xs">
                <SSText color="muted" uppercase>
                  SCRIPT (ASM)
                </SSText>
                <SSText type='mono' uppercase>
                  {script}
                </SSText>
              </SSVStack>
            </SSVStack>
            <SSSeparator />
            <SSVStack gap="sm">
              <SSText uppercase weight="bold" size="md">
                DERIVATION
              </SSText>
              <SSHStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    Path
                  </SSText>
                  <SSText uppercase>{address.derivationPath || '-'}</SSText>
                </SSVStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    Index
                  </SSText>
                  <SSText uppercase>
                    {address.index !== undefined ? address.index : '-'}
                  </SSText>
                </SSVStack>
              </SSHStack>
              <SSHStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    Master Fingerprint
                  </SSText>
                  <SSText uppercase>{account.fingerprint || '-'}</SSText>
                </SSVStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    KEYCHAIN
                  </SSText>
                  <SSText uppercase>{address.keychain || '-'}</SSText>
                </SSVStack>
              </SSHStack>
            </SSVStack>
          </SSVStack>
        </ScrollView>
      </SSMainLayout>
    </ScrollView>
  )
}

export default AddressDetails
