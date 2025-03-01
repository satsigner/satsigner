import { Stack, useLocalSearchParams } from 'expo-router'
import { ScrollView } from 'react-native'

import SSClipboardCopy from '@/components/SSClipboardCopy'
import SSLabelDetails from '@/components/SSLabelDetails'
import SSSeparator from '@/components/SSSeparator'
import SSText from '@/components/SSText'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { useAccountsStore } from '@/store/accounts'
import { type AddrSearchParams } from '@/types/navigation/searchParams'
import { formatNumber } from '@/utils/format'
import SSAddressDisplay from '@/components/SSAddressDisplay'

function AddressDetails() {
  const { id: accountId, addr } = useLocalSearchParams<AddrSearchParams>()

  const [account, address] = useAccountsStore((state) => [
    state.accounts.find((account) => account.name === accountId),
    state.accounts
      .find((account) => account.name === accountId)
      ?.addresses.find((address) => {
        // TODO: remove keychain after fixing the internal address BUG
        return address.address === addr && address.keychain === 'internal'
      })
  ])

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
                    Network
                  </SSText>
                  <SSText uppercase>{address.network || '-'}</SSText>
                </SSVStack>
                <SSVStack gap="xs" style={{ width: '45%', flexGrow: 1 }}>
                  <SSText color="muted" uppercase>
                    Script version
                  </SSText>
                  <SSText uppercase>{address.scriptVersion || '-'}</SSText>
                </SSVStack>
              </SSHStack>
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
