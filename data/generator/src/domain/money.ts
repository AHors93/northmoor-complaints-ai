export function formatPence(pence: number): string {
  return `£${Math.floor(pence / 100)}.${String(pence % 100).padStart(2, '0')}`;
}
