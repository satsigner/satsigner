function formatAddress(address: string) {
  if (address.length <= 16) return address

  const beginning = address.substring(0, 8)
  const end = address.substring(address.length - 8, address.length)
  return `${beginning}...${end}`
}

export { formatAddress }
