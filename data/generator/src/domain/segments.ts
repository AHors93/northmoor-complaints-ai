export type PiiType =
  'name' | 'account_number' | 'sort_code' | 'phone' | 'email' | 'postcode' | 'address';

/** Text is built from segments, so planted PII is recorded rather than detected afterwards. */
export type Segment = string | { type: PiiType; value: string };

export interface PlantedPii {
  type: PiiType;
  value: string;
  /** UTF-16 offsets into the exported text. `end` is exclusive. */
  start: number;
  end: number;
}

export function render(segments: readonly Segment[]): { text: string; pii: PlantedPii[] } {
  let text = '';
  const pii: PlantedPii[] = [];
  for (const segment of segments) {
    const start = text.length;
    if (typeof segment === 'string') {
      text += segment;
    } else {
      text += segment.value;
      pii.push({ ...segment, start, end: text.length });
    }
  }
  return { text, pii };
}

export function mapText(
  segments: readonly Segment[],
  transform: (text: string) => string,
): Segment[] {
  return segments.map((s) =>
    typeof s === 'string' ? transform(s) : { ...s, value: transform(s.value) },
  );
}
