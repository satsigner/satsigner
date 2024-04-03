export default function numFormat(num: number, decimals = 0): string {
  if (num === undefined) {
    return '';
  }

  if (decimals > 0) {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  } else {
    return num.toLocaleString();
  }
}