/** RFC 4180: quote every cell, double embedded quotes, CRLF line endings. */
export function toCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, ...rows]
    .map((row) => `${row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')}\r\n`)
    .join('');
}
