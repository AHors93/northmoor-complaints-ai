/** A deliberately separate reader, so the CSV writer isn't checked against itself. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    if (quoted) {
      if (char !== '"') cell += char;
      else if (text.charAt(i + 1) === '"') {
        cell += '"';
        i++;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      rows.push([...row, cell]);
      row = [];
      cell = '';
    } else if (char !== '\r') cell += char;
  }
  return rows;
}
