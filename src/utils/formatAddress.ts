export default function formatAddress(address: string): string {
  if (address.length <= 16) {
    return address;
  }

  // Show first and last eight characters - https://bitcoin.stackexchange.com/a/119182
  const beginning = address.substring(0, 8);
  const end = address.substring(address.length - 8, address.length);
  return `${beginning}...${end}`;
}
