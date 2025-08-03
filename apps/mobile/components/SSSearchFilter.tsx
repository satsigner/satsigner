import { useState } from 'react'

import SSHStack from '@/layouts/SSHStack'
import SSVStack from '@/layouts/SSVStack'

import SSAddressList, { type SSAddressListProps } from './SSAddressList'
import SSSeparator from './SSSeparator'
import SSTextInput from './SSTextInput'
import SSTransactionList, {
  type SSTransactionListProps
} from './SSTransactionList'

export type SSSearchFilterInputProps = {
  searchQuery: string
  onChangeSearchQuery: (text: string) => void
}

export type SSSearchFilterProps = SSTransactionListProps & SSAddressListProps

export type SSSearchFilterResultsProps = {
  searchQuery: string
} & SSSearchFilterProps

function SSSearchFilterInput({
  searchQuery,
  onChangeSearchQuery
}: SSSearchFilterInputProps) {
  return (
    <SSHStack>
      <SSTextInput value={searchQuery} onChangeText={onChangeSearchQuery} />
    </SSHStack>
  )
}

function SSSearchFilterResults({
  transactions,
  addresses,
  expand,
  refreshing,
  blockchainHeight,
  handleOnRefresh,
  change,
  showDerivationPath
}: SSSearchFilterResultsProps) {
  return (
    <>
      <SSTransactionList
        transactions={transactions}
        expand={expand}
        refreshing={refreshing}
        blockchainHeight={blockchainHeight}
        handleOnRefresh={handleOnRefresh}
      />
      <SSAddressList
        addresses={addresses}
        change={change}
        showDerivationPath={showDerivationPath}
      />
    </>
  )
}

function SSSearchFilter(props: SSSearchFilterProps) {
  const [search, setSearch] = useState('')

  return (
    <SSVStack>
      <SSSearchFilterInput
        searchQuery={search}
        onChangeSearchQuery={setSearch}
      />
      <SSSeparator />
      <SSSearchFilterResults {...props} searchQuery={search} />
    </SSVStack>
  )
}

export default SSSearchFilter

export { SSSearchFilter, SSSearchFilterInput, SSSearchFilterResults }
