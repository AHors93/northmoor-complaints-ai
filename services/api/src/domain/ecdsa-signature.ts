import { AppError } from '@northmoor/shared';

const SEQUENCE = 0x30;
const INTEGER = 0x02;
const PART_LENGTH = 32;

/** KMS returns P-256 signatures as DER; JWTs need r and s as fixed-length bytes. */
export function derToJose(der: Uint8Array): Uint8Array {
  // A P-256 signature is at most 72 bytes, so every DER length fits in one byte.
  if (der[0] !== SEQUENCE || der[1] !== der.length - 2) throw invalid();
  const out = new Uint8Array(PART_LENGTH * 2);
  let offset = 2;
  for (const part of [0, 1]) {
    const length = der[offset + 1];
    if (der[offset] !== INTEGER || length === undefined || length === 0) throw invalid();
    const start = offset + 2;
    offset = start + length;
    if (offset > der.length) throw invalid();
    let value = der.subarray(start, offset);
    // DER adds a zero byte when the top bit is set, so the integer stays positive.
    if (value.length > 1 && value[0] === 0) value = value.subarray(1);
    if (value.length > PART_LENGTH) throw invalid();
    out.set(value, PART_LENGTH * (part + 1) - value.length);
  }
  if (offset !== der.length) throw invalid();
  return out;
}

function invalid(): AppError {
  return new AppError('Signature is not valid DER', {
    code: 'TOOL_TOKEN_SIGNATURE_INVALID',
    retryable: false,
  });
}
