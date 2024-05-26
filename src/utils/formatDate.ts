export default function formatDate(date: Date): string {
  if (typeof(date) === 'string') {
    date = new Date(date);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}
