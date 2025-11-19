import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import uuid from 'react-native-uuid'
import { toast } from 'sonner-native'
import { useShallow } from 'zustand/react/shallow'

import SSAddressDisplay from '@/components/SSAddressDisplay'
import SSButton from '@/components/SSButton'
import SSCheckbox from '@/components/SSCheckbox'
import SSModal from '@/components/SSModal'
import SSStyledSatText from '@/components/SSStyledSatText'
import SSText from '@/components/SSText'
import SSTextInput from '@/components/SSTextInput'
import SSHStack from '@/layouts/SSHStack'
import SSMainLayout from '@/layouts/SSMainLayout'
import SSVStack from '@/layouts/SSVStack'
import { t } from '@/locales'
import { useAccountsStore } from '@/store/accounts'
import { type Account, type Key, type Secret } from '@/types/models/Account'
import { type Address } from '@/types/models/Address'
import { type AccountSearchParams } from '@/types/navigation/searchParams'
import { getScriptVersionType } from '@/utils/address'
import { validateAddress } from '@/utils/validation'

type WatchedAddress = Address & {
  new?: boolean
}

export default function ManageAccountAddresses() {
  const { id: accountId } = useLocalSearchParams<AccountSearchParams>()

  const [account, updateAccount] = useAccountsStore(
    useShallow((state) => [
      state.accounts.find((_account) => _account.id === accountId),
      state.updateAccount
    ])
  )

  const [currencyUnit, setSatsUnit] = useState<'sats' | 'btc'>('sats')
  const [addresses, setAddresses] = useState<WatchedAddress[]>([
    ...(account?.addresses || [])
  ])

  const [showAddAddressModal, setShowAddAddressModal] = useState(false)
  const [showDeleteAddressModal, setShowDeleteAddressModal] = useState(false)
  const [addressInput, setAddressInput] = useState('')
  const [addressToDelete, setAddressToDelete] = useState('')

  const isMultiAddressWatchOnly = useMemo(() => {
    return (
      account &&
      account.keys.length > 1 &&
      account.keys[0].creationType === 'importAddress'
    )
  }, [account])

  function handleAddAddress() {
    const address = addressInput.trim()
    if (!validateAddress(address)) {
      toast.error('Invalid address')
      return
    }

    const duplicated = addresses.some((addr) => addr.address === address)
    if (duplicated) {
      toast.error('Duplicated address')
      return
    }

    addAddress(address)
    setShowAddAddressModal(false)
  }

  function handleDeleteAddress(address: string) {
    setShowDeleteAddressModal(true)
    setAddressToDelete(address)
  }

  function deleteAddress(address: string) {
    setAddresses(addresses.filter((addr) => addr.address !== address))
    setShowDeleteAddressModal(false)
  }

  function addAddress(address: string) {
    const newAddress: WatchedAddress = {
      address,
      label: '',
      transactions: [],
      utxos: [],
      scriptVersion: getScriptVersionType(address) || undefined,
      summary: {
        utxos: 0,
        transactions: 0,
        satsInMempool: 0,
        balance: 0
      },
      new: true
    }
    setAddresses([...addresses, newAddress])
  }

  async function handleSaveChanges() {
    if (!account) return

    // the account keys has the addresses stored as external descriptors
    const keys = addresses.map((addr, index) => {
      const secret: Secret = {
        externalDescriptor: `addr(${addr.address})`
      }
      const key: Key = {
        index,
        secret,
        creationType: 'importAddress',
        iv: uuid.v4().replace(/-/g, '')
      }
      return key
    })
    const keyCount = keys.length

    const updatedAccount: Account = {
      ...account,
      addresses,
      syncStatus: 'unsynced',
      keyCount,
      keys
    }
    updateAccount(updatedAccount)

    router.back()
  }

  if (!account || !isMultiAddressWatchOnly) return <Redirect href="/" />

  return (
    <SSMainLayout style={{ marginBottom: 20 }}>
      <ScrollView>
        <SSVStack gap="lg">
          <SSText uppercase size="lg" weight="bold">
            Manage addresses
          </SSText>
          <SSVStack gap="sm">
            <SSText size="md" weight="bold">
              Currency display options:
            </SSText>
            <SSCheckbox
              selected={currencyUnit === 'sats'}
              onPress={() => setSatsUnit('sats')}
              label="SATS"
            />
            <SSCheckbox
              selected={currencyUnit === 'btc'}
              onPress={() => setSatsUnit('btc')}
              label="BTC"
            />
          </SSVStack>
          <SSVStack gap="lg">
            {addresses.map((address, index) => {
              return (
                <SSVStack gap="sm" key={address.address}>
                  <SSText uppercase weight="bold">
                    {`Address #${index + 1}`} {address.new && '(NEW)'}
                  </SSText>
                  <SSAddressDisplay address={address.address} />
                  {!address.new && (
                    <SSVStack gap="none">
                      <SSText>
                        Current balance:{' '}
                        <SSStyledSatText
                          amount={address.summary.balance}
                          useZeroPadding={currencyUnit === 'btc'}
                          textSize="sm"
                          noColor
                        />
                      </SSText>
                      {address.summary.satsInMempool > 0 && (
                        <SSText>
                          Unconfirmed funds in mempool:{' '}
                          <SSStyledSatText
                            amount={address.summary.satsInMempool}
                            useZeroPadding={currencyUnit === 'btc'}
                            textSize="sm"
                            noColor
                          />
                        </SSText>
                      )}
                      <SSText>
                        Total UTXOs:{' '}
                        <SSText weight="bold">{address.summary.utxos}</SSText>
                      </SSText>
                      <SSText>
                        Total Transactions:{' '}
                        <SSText weight="bold">
                          {address.summary.transactions}
                        </SSText>
                      </SSText>
                      <SSText>
                        Label:{' '}
                        {address.label ? (
                          <SSText weight="bold">{address.label}</SSText>
                        ) : (
                          <SSText color="muted">{t('common.noLabel')}</SSText>
                        )}
                      </SSText>
                    </SSVStack>
                  )}
                  <SSHStack gap="sm" justifyBetween>
                    <SSButton
                      style={styles.addressActionButton}
                      label="VIEW DETAILS"
                      variant="secondary"
                      disabled={address.new}
                      onPress={() =>
                        router.navigate(
                          `/account/${accountId}/address/${address.address}`
                        )
                      }
                    />
                    <SSButton
                      style={styles.addressActionButton}
                      label="DELETE"
                      variant="danger"
                      onPress={() => handleDeleteAddress(address.address)}
                    />
                  </SSHStack>
                </SSVStack>
              )
            })}
          </SSVStack>
          <SSVStack gap="sm">
            <SSButton
              label="Add address"
              variant="outline"
              uppercase
              onPress={() => setShowAddAddressModal(true)}
            />
            <SSButton
              label={t('common.save')}
              variant="secondary"
              uppercase
              onPress={handleSaveChanges}
            />
          </SSVStack>
        </SSVStack>
      </ScrollView>
      <SSModal
        visible={showDeleteAddressModal}
        onClose={() => setShowDeleteAddressModal(false)}
      >
        <SSVStack gap="lg" style={styles.modalContainer}>
          <SSText size="lg" center>
            You are about to delete the following address:
          </SSText>
          <SSAddressDisplay address={addressToDelete} variant="bare" />
          <SSVStack gap="sm">
            <SSButton
              label={t('common.yes')}
              variant="outline"
              uppercase
              onPress={() => deleteAddress(addressToDelete)}
            />
            <SSButton
              label={t('common.no')}
              variant="danger"
              uppercase
              onPress={() => setShowDeleteAddressModal(false)}
            />
          </SSVStack>
        </SSVStack>
      </SSModal>
      <SSModal
        visible={showAddAddressModal}
        onClose={() => setShowAddAddressModal(false)}
        fullOpacity
      >
        <SSVStack gap="lg" style={styles.modalContainer}>
          <SSTextInput
            value={addressInput}
            onChangeText={setAddressInput}
            placeholder="Enter new address!"
            multiline
            style={{ height: 'auto' }}
            numberOfLines={5}
          />
          <SSVStack gap="sm">
            <SSButton
              label={t('common.save')}
              variant="outline"
              uppercase
              onPress={() => handleAddAddress()}
            />
            <SSButton
              label={t('common.cancel')}
              variant="danger"
              uppercase
              onPress={() => setShowAddAddressModal(false)}
            />
          </SSVStack>
        </SSVStack>
      </SSModal>
    </SSMainLayout>
  )
}

const styles = StyleSheet.create({
  addressActionButton: {
    width: '48%',
    padding: 12,
    height: 'auto'
  },
  modalContainer: {
    justifyContent: 'center',
    height: '100%',
    width: '100%'
  }
})
