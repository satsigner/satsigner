function formatAddress(address: string, character: number = 8) {
  if (address.length <= 16) return address

  const beginning = address.substring(0, character)
  const end = address.substring(address.length - character, address.length)
  return `${beginning}...${end}`
}

function formatNumber(n: number, decimals = 0) {
  return decimals > 0
    ? n.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })
    : n.toLocaleString()
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: 'numeric'
  })
    .format(date)
    .replace(' ', '')
    .toLowerCase()
}

function formatDate(date: Date | string | number) {
  if (typeof date === 'string') {
    date = new Date(date)
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}

export { formatAddress, formatDate, formatNumber, formatTime }
